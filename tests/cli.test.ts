import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseJournal,
  serializeJournal,
} from "../skills/journal/scripts/format.ts";
import { sandbox } from "./sandbox.ts";

const cli = fileURLToPath(
  new URL("../skills/journal/scripts/journal.ts", import.meta.url),
);
function run(
  box: ReturnType<typeof sandbox>,
  args: string[],
  env: NodeJS.ProcessEnv = {},
) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: box.cwd,
    env: { ...box.env, ...env },
    encoding: "utf8",
  });
}

test("CLI read flags select author/date windows, enforce limits, and report exact omissions", (t) => {
  const box = sandbox(t);
  fs.mkdirSync(box.directory);
  const alice = Array.from({ length: 25 }, (_, i) => ({
    timestamp: "2026-10-23T12:00:00.000+00:00",
    content: `Alice ${i}`,
    author: "Alice",
  }));
  const bob = {
    timestamp: "2026-10-26T12:00:00.000+00:00",
    content: "Bob",
    author: "Bob",
  };
  const older = {
    timestamp: "2026-10-22T12:00:00.000+00:00",
    content: "older",
    author: "Alice",
  };
  const file = join(box.directory, "journal.md");
  const source = serializeJournal([bob, ...alice, older]);
  fs.writeFileSync(file, source);
  const read = run(box, ["read", "--author", "Alice"]);
  assert.equal(read.status, 0, read.stderr);
  assert.equal(
    read.stdout,
    `${serializeJournal(alice.slice(0, 20))}\nOmitted 5 matching entries.\n`,
  );
  const since = run(box, [
    "read",
    "--author",
    "Alice",
    "--since",
    "2026-10-22",
    "--limit",
    "100",
  ]);
  assert.equal(since.status, 0, since.stderr);
  assert.deepEqual(parseJournal(since.stdout), [...alice, older]);
  const exact = run(box, ["read", "--date", "2026-10-23", "--limit", "2"]);
  assert.equal(exact.status, 0, exact.stderr);
  assert.equal(
    exact.stdout,
    `${serializeJournal(alice.slice(0, 2))}\nOmitted 23 matching entries.\n`,
  );
  assert.equal(
    run(box, ["read", "--date", "2026-10-28"]).stdout,
    "No matching journal entries.\n",
  );
  assert.deepEqual(parseJournal(run(box, ["read"]).stdout), [bob]);
  assert.equal(fs.readFileSync(file, "utf8"), source);
});

test("directory precedence is explicit flag, environment, then invocation CWD", (t) => {
  const box = sandbox(t);
  const environment = join(box.root, "environment notes");
  const explicit = join(box.cwd, "explicit notes");
  assert.equal(run(box, ["write", "default"]).status, 0);
  assert.equal(
    run(box, ["write", "environment"], { AGENT_JOURNAL_DIR: environment })
      .status,
    0,
  );
  assert.equal(
    run(box, ["--dir", "explicit notes", "write", "explicit"], {
      AGENT_JOURNAL_DIR: environment,
    }).status,
    0,
  );
  for (const [directory, content] of [
    [box.directory, "default"],
    [environment, "environment"],
    [explicit, "explicit"],
  ]) {
    assert.equal(
      parseJournal(
        fs.readFileSync(join(directory ?? "", "journal.md"), "utf8"),
      )[0]?.content,
      content,
    );
  }
  const read = run(box, ["read", "--dir", explicit], {
    AGENT_JOURNAL_DIR: environment,
  });
  assert.equal(read.status, 0, read.stderr);
  assert.equal(parseJournal(read.stdout)[0]?.content, "explicit");
});

test("CLI rejects invalid arguments without changing stored entries", (t) => {
  const box = sandbox(t);
  assert.equal(run(box, ["write", "kept"]).status, 0);
  const file = join(box.directory, "journal.md");
  const before = fs.readFileSync(file);
  const invalid = [
    ["write"],
    ["write", "one", "two"],
    ["write", " \r\n "],
    ["write", "😀".repeat(501)],
    ["read", "extra"],
    ["read", "--file", "other.md"],
    ["read", "--date", "today", "--since", "yesterday"],
    ["read", "--since", "yesterday", "--date", "today"],
    ["read", "--date", "junk yesterday"],
    ["read", "--since", "2026-13-01"],
    ...["0", "-1", "1.5", "1e2", "Infinity", "9007199254740992", "no"].map(
      (value) => ["read", `--limit=${value}`],
    ),
  ];
  for (const args of invalid) {
    const result = run(box, args);
    assert.notEqual(result.status, 0, args.join(" "));
    assert.notEqual(result.stderr, "", args.join(" "));
    assert.deepEqual(fs.readFileSync(file), before);
  }
});

test("missing reads and help do not create state, and authors are never inferred", (t) => {
  const box = sandbox(t);
  const read = run(box, ["read"]);
  assert.equal(read.status, 0, read.stderr);
  assert.equal(read.stdout, "No matching journal entries.\n");
  assert.equal(run(box, ["--help"]).status, 0);
  assert.equal(fs.existsSync(box.directory), false);
  const write = run(box, ["write", "anonymous"], {
    USER: "not-an-author",
    LOGNAME: "also-not-an-author",
  });
  assert.equal(write.status, 0, write.stderr);
  const entry = parseJournal(
    fs.readFileSync(join(box.directory, "journal.md"), "utf8"),
  )[0];
  assert.ok(entry);
  assert.equal(Object.hasOwn(entry, "author"), false);
  const executable = spawnSync(cli, ["read"], {
    cwd: box.cwd,
    env: box.env,
    encoding: "utf8",
  });
  assert.equal(executable.status, 0, executable.stderr);
  assert.deepEqual(parseJournal(executable.stdout), [entry]);
});

test("CLI refuses malformed journal files on reads and writes without changing bytes", (t) => {
  const box = sandbox(t);
  fs.mkdirSync(box.directory);
  const file = join(box.directory, "journal.md");
  const corrupt = "# Journal v1\n\n## 2026-10-27\n- unknown metadata\n";
  fs.writeFileSync(file, corrupt);
  for (const args of [["read"], ["write", "new"]]) {
    const result = run(box, args);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(file), result.stderr);
    assert.equal(fs.readFileSync(file, "utf8"), corrupt);
  }
});

test("independent source CLI processes publish unique entries concurrently", async (t) => {
  const box = sandbox(t);
  await Promise.all(
    Array.from(
      { length: 16 },
      (_, index) =>
        new Promise<void>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [cli, "write", "--author", String(index), `CLI ${index}`],
            { cwd: box.cwd, env: box.env },
          );
          let stderr = "";
          child.stderr.on("data", (chunk) => {
            stderr += chunk;
          });
          child.on("error", reject);
          child.on("close", (code) =>
            code === 0 ? resolve() : reject(new Error(stderr)),
          );
        }),
    ),
  );
  const entries = parseJournal(
    fs.readFileSync(join(box.directory, "journal.md"), "utf8"),
  );
  assert.equal(entries.length, 16);
  assert.equal(new Set(entries.map((entry) => entry.content)).size, 16);
  for (let index = 0; index < 16; index++)
    assert.ok(
      entries.some(
        (entry) =>
          entry.content === `CLI ${index}` && entry.author === String(index),
      ),
    );
});

test("the source TypeScript CLI writes and reads in an unrelated project using Node alone", (t) => {
  const box = sandbox(t);
  const write = run(box, [
    "write",
    "--author",
    "Alice\n😀",
    " First\r\nentry  with  spaces ",
  ]);
  assert.equal(write.status, 0, write.stderr);
  assert.equal(write.stderr, "");
  const entries = parseJournal(
    fs.readFileSync(join(box.directory, "journal.md"), "utf8"),
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.content, "First entry  with  spaces");
  assert.equal(entries[0]?.author, "Alice\n😀");
  assert.match(entries[0]?.timestamp ?? "", /\+00:00$/);
  const bytes = fs.readFileSync(join(box.directory, "journal.md"));
  const before = fs.statSync(join(box.directory, "journal.md"));
  const read = run(box, ["read"]);
  assert.equal(read.status, 0, read.stderr);
  assert.deepEqual(parseJournal(read.stdout), entries);
  assert.deepEqual(fs.readFileSync(join(box.directory, "journal.md")), bytes);
  assert.equal(
    fs.statSync(join(box.directory, "journal.md")).mtimeMs,
    before.mtimeMs,
  );
});
