import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDay, timestamp } from "../skills/journal/scripts/dates.ts";

process.env.TZ = "America/Chicago";
const reference = new Date("2026-10-27T12:00:00-05:00");

test("parses promised English relative dates with a fixed local reference", () => {
  const examples = {
    yesterday: "2026-10-26",
    "last Monday": "2026-10-26",
    "last Friday": "2026-10-23",
    "2 days ago": "2026-10-25",
    "2 weeks ago": "2026-10-13",
    "last week": "2026-10-20",
    "-3 days": "2026-10-24",
    "today - 2 days": "2026-10-25",
  };
  for (const [input, expected] of Object.entries(examples))
    assert.equal(parseDay(input, reference), expected, input);
});

test("rejects junk, partial extraction, multiple dates, and ranges", () => {
  for (const input of [
    "",
    "nonsense",
    "junk yesterday",
    "yesterday junk",
    "yesterday and tomorrow",
    "Monday to Friday",
    "2026-99-99",
  ]) {
    assert.throws(() => parseDay(input, reference), /Invalid date/, input);
  }
});

test("formats local days with the offset at that instant, including DST and midnight boundaries", () => {
  assert.equal(
    timestamp(new Date("2026-01-01T02:03:04.005Z")),
    "2025-12-31T20:03:04.005-06:00",
  );
  assert.equal(
    timestamp(new Date("2026-07-01T02:03:04.005Z")),
    "2026-06-30T21:03:04.005-05:00",
  );
  assert.equal(
    parseDay("yesterday", new Date("2026-03-09T00:30:00-05:00")),
    "2026-03-08",
  );
  process.env.TZ = "Asia/Kathmandu";
  assert.equal(
    timestamp(new Date("2026-01-01T00:00:00.000Z")),
    "2026-01-01T05:45:00.000+05:45",
  );
  assert.equal(parseDay("2026-01-01", reference), "2026-01-01");
  process.env.TZ = "UTC";
  assert.equal(timestamp(reference), "2026-10-27T17:00:00.000+00:00");
  process.env.TZ = "America/Chicago";
});

test("keeps ISO date-only inputs on their local day and permits native calendar normalization", () => {
  assert.equal(parseDay(" 2026-10-27 ", reference), "2026-10-27");
  assert.equal(parseDay("2026-02-30", reference), "2026-03-02");
  assert.equal(parseDay("0099-01-02", reference), "0099-01-02");
  for (const value of ["2026-13-01", "2026-01-32", "2026-00-01"]) {
    assert.throws(() => parseDay(value, reference), /date/i);
  }
});
