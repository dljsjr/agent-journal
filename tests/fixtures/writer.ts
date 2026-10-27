import assert from "node:assert/strict";
import { writeEntry } from "../../skills/journal/scripts/store.ts";

const [directory, prefix, count = "1"] = process.argv.slice(2);
assert.ok(directory && prefix);
process.stdout.write("ready\n");
for (let index = 0; index < Number(count); index++) {
  writeEntry(
    directory,
    `${prefix}:${index}`,
    prefix,
    new Date("2026-10-27T12:00:00Z"),
  );
}
