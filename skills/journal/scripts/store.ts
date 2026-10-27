import childProcess from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { join } from "node:path";
import { timestamp } from "./dates.ts";
import {
  type Entry,
  normalizeContent,
  parseJournal,
  serializeJournal,
} from "./format.ts";

export function writeEntry(
  directory: string,
  input: string,
  author?: string,
  now = new Date(),
): Entry {
  const entry: Entry = {
    timestamp: timestamp(now),
    content: normalizeContent(input),
  };
  if (author !== undefined) entry.author = author;
  fs.mkdirSync(directory, { recursive: true });
  const descriptor = fs.openSync(join(directory, ".journal.lock"), "a+", 0o600);
  try {
    acquireLock(descriptor);
    const entries = [entry, ...readJournal(directory)].slice(0, 200);
    const temporary = join(directory, `.journal-${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporary, serializeJournal(entries), {
        flag: "wx",
        mode: 0o600,
      });
      fs.renameSync(temporary, join(directory, "journal.md"));
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return entry;
}

function acquireLock(descriptor: number): void {
  let utility: string;
  let args: string[];
  if (process.platform === "darwin") {
    utility = "/usr/bin/lockf";
    args = ["-s", "-t", "10", "3"];
  } else if (process.platform === "linux") {
    utility = "/usr/bin/flock";
    args = ["-x", "-w", "10", "3"];
  } else {
    throw new Error("Journal writes require macOS lockf or Linux flock.");
  }
  // The parent descriptor retains the kernel lock after the utility exits.
  const result = childProcess.spawnSync(utility, args, {
    stdio: ["ignore", "pipe", "pipe", descriptor],
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    const reason =
      result.error?.message ??
      (result.stderr.trim() || `exit ${result.status}`);
    throw new Error(
      `Cannot acquire journal lock with ${utility} (10 second wait): ${reason}`,
    );
  }
}

export function readJournal(directory: string): Entry[] {
  const file = join(directory, "journal.md");
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
  try {
    return parseJournal(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    );
  } catch (error) {
    throw new Error(
      `Cannot parse journal ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
