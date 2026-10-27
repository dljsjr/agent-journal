import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { readJournal, writeEntry } from "../skills/journal/scripts/store.ts";
import { sandbox } from "./sandbox.ts";

const fixture = new URL("./fixtures/writer.ts", import.meta.url);
function writer(box: ReturnType<typeof sandbox>, prefix: string, count = 1) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(fixture), box.directory, prefix, String(count)],
    { cwd: box.cwd, env: box.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const done = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`writer ${prefix}: ${code}: ${stderr}`)),
    );
  });
  return { child, done };
}

test("independent Node writers publish every unique entry without lost updates", async (t) => {
  const box = sandbox(t);
  writeEntry(box.directory, "seed");
  const lock = fs.statSync(join(box.directory, ".journal.lock")).ino;
  await Promise.all(
    Array.from({ length: 24 }, (_, i) => writer(box, `worker-${i}`, 3).done),
  );
  const entries = readJournal(box.directory);
  assert.equal(entries.length, 73);
  assert.equal(new Set(entries.map((entry) => entry.content)).size, 73);
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 3; j++)
      assert.ok(
        entries.some(
          (entry) =>
            entry.content === `worker-${i}:${j}` &&
            entry.author === `worker-${i}`,
        ),
      );
  }
  assert.equal(entries.at(-1)?.content, "seed");
  assert.equal(fs.statSync(join(box.directory, ".journal.lock")).ino, lock);
  assert.deepEqual(fs.readdirSync(box.directory).sort(), [
    ".journal.lock",
    "journal.md",
  ]);
});

test("concurrent publication also enforces the global retention ceiling", async (t) => {
  const box = sandbox(t);
  await Promise.all(
    Array.from({ length: 12 }, (_, i) => writer(box, `retained-${i}`, 20).done),
  );
  const entries = readJournal(box.directory);
  assert.equal(entries.length, 200);
  assert.equal(new Set(entries.map((entry) => entry.content)).size, 200);
  assert.ok(entries.every((entry) => /^retained-\d+:\d+$/.test(entry.content)));
});

test("lock acquisition times out without modifying the journal", {
  timeout: 15_000,
}, async (t) => {
  const box = sandbox(t);
  writeEntry(box.directory, "seed");
  const file = join(box.directory, "journal.md");
  const bytes = fs.readFileSync(file);
  const descriptor = fs.openSync(join(box.directory, ".journal.lock"), "a+");
  const utility =
    process.platform === "darwin" ? "/usr/bin/lockf" : "/usr/bin/flock";
  const args =
    process.platform === "darwin"
      ? ["-s", "-t", "1", "3"]
      : ["-x", "-w", "1", "3"];
  try {
    assert.equal(
      spawnSync(utility, args, {
        stdio: ["ignore", "pipe", "pipe", descriptor],
      }).status,
      0,
    );
    const pending = writer(box, "timeout");
    t.after(() => {
      if (pending.child.exitCode === null) pending.child.kill();
    });
    await assert.rejects(
      pending.done,
      /Cannot acquire journal lock.*10 second wait/,
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
  } finally {
    fs.closeSync(descriptor);
  }
});

test("the Node-held descriptor excludes a writer after the utility exits and releases on close", async (t) => {
  const box = sandbox(t);
  writeEntry(box.directory, "seed");
  const descriptor = fs.openSync(join(box.directory, ".journal.lock"), "a+");
  const utility =
    process.platform === "darwin" ? "/usr/bin/lockf" : "/usr/bin/flock";
  const args =
    process.platform === "darwin"
      ? ["-s", "-t", "1", "3"]
      : ["-x", "-w", "1", "3"];
  assert.equal(
    spawnSync(utility, args, { stdio: ["ignore", "pipe", "pipe", descriptor] })
      .status,
    0,
  );
  const pending = writer(box, "waiting");
  try {
    await once(pending.child.stdout, "data");
    await setTimeout(150);
    assert.equal(pending.child.exitCode, null);
    assert.deepEqual(
      readJournal(box.directory).map((entry) => entry.content),
      ["seed"],
    );
  } finally {
    fs.closeSync(descriptor);
  }
  await pending.done;
  assert.deepEqual(
    readJournal(box.directory).map((entry) => entry.content),
    ["waiting:0", "seed"],
  );
});
