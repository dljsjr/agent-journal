import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { serializeJournal } from "../skills/journal/scripts/format.ts";
import { readJournal, writeEntry } from "../skills/journal/scripts/store.ts";
import { sandbox } from "./sandbox.ts";

test("writes normalized entries with explicit attribution newest first and reads without mutation", (t) => {
  const { directory } = sandbox(t);
  const first = writeEntry(
    directory,
    " first\r\nentry ",
    "A\nB",
    new Date("2026-10-26T12:00:00.000Z"),
  );
  const second = writeEntry(
    directory,
    "second",
    undefined,
    new Date("2026-10-27T12:00:00.000Z"),
  );
  assert.equal(first.content, "first entry");
  assert.equal(first.author, "A\nB");
  assert.match(second.timestamp, /^[0-9T:.+-]+$/);
  const file = join(directory, "journal.md");
  const bytes = fs.readFileSync(file);
  const before = fs.statSync(file);
  assert.deepEqual(readJournal(directory), [second, first]);
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.equal(fs.statSync(file).mtimeMs, before.mtimeMs);
  assert.deepEqual(fs.readdirSync(directory).sort(), [
    ".journal.lock",
    "journal.md",
  ]);
});

test("retains exactly 200 entries and removes the empty oldest day without changing retained metadata", (t) => {
  const { directory } = sandbox(t);
  fs.mkdirSync(directory);
  const retained = Array.from({ length: 199 }, (_, i) => ({
    timestamp: "2026-10-26T12:00:00.000+00:00",
    content: `entry ${i}`,
    author: String(i % 2),
  }));
  const oldest = {
    timestamp: "2026-10-25T00:00:00.000+00:00",
    content: "drop me",
  };
  fs.writeFileSync(
    join(directory, "journal.md"),
    serializeJournal([...retained, oldest]),
  );
  const added = writeEntry(
    directory,
    "new",
    undefined,
    new Date("2026-10-27T12:00:00Z"),
  );
  assert.deepEqual(readJournal(directory), [added, ...retained]);
  assert.equal(
    fs
      .readFileSync(join(directory, "journal.md"), "utf8")
      .includes("## 2026-10-25"),
    false,
  );
});

test("refuses invalid UTF-8 rather than rewriting replacement characters", (t) => {
  const { directory } = sandbox(t);
  fs.mkdirSync(directory);
  const text = serializeJournal([
    { timestamp: "2026-10-27T12:00:00.000+00:00", content: "bad BYTE" },
  ]);
  const bytes = Buffer.from(text.replace("BYTE", "\ufffd"));
  const offset = bytes.indexOf(Buffer.from("\ufffd"));
  const corrupt = Buffer.concat([
    bytes.subarray(0, offset),
    Buffer.from([0xff]),
    bytes.subarray(offset + 3),
  ]);
  const file = join(directory, "journal.md");
  fs.writeFileSync(file, corrupt);
  assert.throws(() => writeEntry(directory, "no"), /UTF-8|encoded data/i);
  assert.deepEqual(fs.readFileSync(file), corrupt);
});

test("validates the complete file before retention and preserves malformed files byte for byte", (t) => {
  const { directory } = sandbox(t);
  fs.mkdirSync(directory);
  const valid = serializeJournal(
    Array.from({ length: 240 }, (_, i) => ({
      timestamp: "2026-10-27T12:00:00.000+00:00",
      content: `entry ${i}`,
    })),
  );
  const file = join(directory, "journal.md");
  for (const corrupt of [
    "",
    `${valid}unknown suffix\n`,
    valid.replace("v2", "v99"),
    valid.replace("entry 239", String.raw`entry 239\q`),
  ]) {
    fs.writeFileSync(file, corrupt);
    const before = fs.statSync(file);
    assert.throws(() => writeEntry(directory, "no"), /journal/i);
    assert.equal(fs.readFileSync(file, "utf8"), corrupt);
    assert.equal(fs.statSync(file).mtimeMs, before.mtimeMs);
    assert.deepEqual(fs.readdirSync(directory).sort(), [
      ".journal.lock",
      "journal.md",
    ]);
  }
});

test("failed atomic replacement preserves the journal, removes temporary data, and releases the lock", (t) => {
  const { directory } = sandbox(t);
  writeEntry(directory, "kept");
  const file = join(directory, "journal.md");
  const bytes = fs.readFileSync(file);
  const rename = t.mock.method(fs, "renameSync", () => {
    throw new Error("simulated rename failure");
  });
  assert.throws(
    () => writeEntry(directory, "not stored"),
    /simulated rename failure/,
  );
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.deepEqual(fs.readdirSync(directory).sort(), [
    ".journal.lock",
    "journal.md",
  ]);
  rename.mock.restore();
  writeEntry(directory, "next");
  assert.deepEqual(
    readJournal(directory).map((entry) => entry.content),
    ["next", "kept"],
  );
});

test("missing lock utility fails clearly without modifying journal data or leaking a lock", (t) => {
  const { directory } = sandbox(t);
  writeEntry(directory, "kept");
  const file = join(directory, "journal.md");
  const bytes = fs.readFileSync(file);
  const spawn = t.mock.method(childProcess, "spawnSync", () => ({
    pid: 0,
    output: [],
    stdout: "",
    stderr: "",
    status: null,
    signal: null,
    error: new Error("spawn ENOENT"),
  }));
  assert.throws(
    () => writeEntry(directory, "not stored"),
    /Cannot acquire journal lock.*\/usr\/bin\/(lockf|flock).*ENOENT/,
  );
  assert.deepEqual(fs.readFileSync(file), bytes);
  spawn.mock.restore();
  writeEntry(directory, "next");
  assert.deepEqual(
    readJournal(directory).map((entry) => entry.content),
    ["next", "kept"],
  );
});

test("invalid content does not create a directory or change existing data", (t) => {
  const { directory } = sandbox(t);
  assert.throws(() => writeEntry(directory, " ".repeat(5)), /1 to 500/);
  assert.equal(fs.existsSync(directory), false);
  writeEntry(directory, "kept");
  const file = join(directory, "journal.md");
  const bytes = fs.readFileSync(file);
  assert.throws(() => writeEntry(directory, "😀".repeat(501)), /1 to 500/);
  assert.deepEqual(fs.readFileSync(file), bytes);
});

test("reading a missing journal returns no entries without creating its directory", (t) => {
  const { directory } = sandbox(t);
  assert.deepEqual(readJournal(directory), []);
  assert.equal(fs.existsSync(directory), false);
});
