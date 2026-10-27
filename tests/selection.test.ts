import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry } from "../skills/journal/scripts/format.ts";
import { selectEntries } from "../skills/journal/scripts/selection.ts";

const entry = (day: string, content: string, author?: string): Entry => ({
  timestamp: `${day}T12:00:00.000+00:00`,
  content,
  ...(author === undefined ? {} : { author }),
});
const entries = [
  entry("2026-10-26", "rollback", "Alice"),
  entry("2026-10-27", "newest", "Bob"),
  entry("2026-10-23", "friday", "Alice"),
  entry("2026-10-26", "monday", "Alice"),
  entry("2026-10-22", "anonymous"),
];

test("explicit date and inclusive since windows override latest-day selection and preserve publication order", () => {
  assert.deepEqual(
    selectEntries(entries, { window: { kind: "date", day: "2026-10-23" } }),
    { entries: [entries[2]], omitted: 0 },
  );
  assert.deepEqual(
    selectEntries(entries, {
      author: "Alice",
      window: { kind: "since", day: "2026-10-23" },
    }),
    { entries: [entries[0], entries[2], entries[3]], omitted: 0 },
  );
  assert.deepEqual(
    selectEntries(entries, { window: { kind: "since", day: "2026-10-28" } }),
    { entries: [], omitted: 0 },
  );
});

test("limits only the selected window, counts omitted matches, and leaves inputs unchanged", () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    entry("2026-10-27", `entry ${i}`, "Alice"),
  );
  const all = [
    ...many,
    entry("2026-10-27", "Bob", "Bob"),
    entry("2026-10-26", "older", "Alice"),
  ];
  const before = structuredClone(all);
  assert.deepEqual(selectEntries(all, { author: "Alice" }), {
    entries: many.slice(0, 20),
    omitted: 5,
  });
  assert.deepEqual(selectEntries(all, { author: "Alice", limit: 2 }), {
    entries: many.slice(0, 2),
    omitted: 23,
  });
  assert.deepEqual(selectEntries(all, { author: "Alice", limit: 100 }), {
    entries: many,
    omitted: 0,
  });
  assert.equal(
    selectEntries(all, {
      author: "Alice",
      window: { kind: "since", day: "2026-10-26" },
      limit: 2,
    }).omitted,
    24,
  );
  assert.deepEqual(all, before);
});

test("selects the newest matching recorded day after exact author filtering, without filling from older days", () => {
  assert.deepEqual(selectEntries(entries), {
    entries: [entries[1]],
    omitted: 0,
  });
  assert.deepEqual(selectEntries(entries, { author: "Alice" }), {
    entries: [entries[0], entries[3]],
    omitted: 0,
  });
  assert.deepEqual(selectEntries(entries, { author: "alice" }), {
    entries: [],
    omitted: 0,
  });
  assert.deepEqual(selectEntries([]), { entries: [], omitted: 0 });
});
