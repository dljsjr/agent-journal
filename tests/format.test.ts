import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type Entry,
  normalizeContent,
  parseJournal,
  serializeJournal,
} from "../skills/journal/scripts/format.ts";

test("normalizes line breaks without collapsing other internal whitespace", () => {
  assert.equal(
    normalizeContent(
      " \tfirst\r\nsecond\rthird\nfourth\u2028fifth\u2029sixth\u0085last  ",
    ),
    "first second third fourth fifth sixth last",
  );
  assert.equal(normalizeContent("a  \t b"), "a  \t b");
});

test("round trips complete entries and adjacent day groups without interpreting their text", () => {
  const entries: Entry[] = [
    {
      timestamp: "2026-10-27T12:34:56.789-05:00",
      content: '# ## - ` \\" </script> {"content":"fake"} 😀\t  end',
      author: 'A\r\nB\u2028C\u2029D\u0085\\"',
    },
    {
      timestamp: "2026-10-26T02:00:00.000+00:00",
      content: "older",
      author: "",
    },
    { timestamp: "2026-10-27T00:00:00.000+14:00", content: "rollback" },
  ];
  const text = serializeJournal(entries);
  assert.equal(
    text.split("\n").filter((line) => line.startsWith("## ")).length,
    3,
  );
  assert.equal(
    text.split("\n").filter((line) => line.startsWith("- ")).length,
    3,
  );
  assert.equal(text.includes("\u2028"), false);
  assert.deepEqual(parseJournal(text), entries);
  assert.deepEqual(parseJournal(serializeJournal([])), []);
});

test("refuses all unknown or incomplete data instead of returning a recognized subset", () => {
  const valid = serializeJournal([
    { timestamp: "2026-10-27T12:00:00.000-05:00", content: "kept" },
  ]);
  const badFiles = [
    "",
    valid.replace("v1", "v2"),
    `${valid}unrecognized suffix\n`,
    valid.replace('"kept"', '"kept","unknown":true'),
    valid.replace('"kept"', '"kept","author":null'),
    valid.replace('"kept"', "null"),
    valid.replace('"kept"', '""'),
    valid.replace('"kept"', '" leading space"'),
    valid.replace('"kept"', '"line\\nfeed"'),
    valid.replace('"kept"', JSON.stringify("x".repeat(501))),
    valid.replace("## 2026-10-27", "## 2026-10-26"),
    valid.replace("T12:00:00.000-05:00", "T12:00:00.000"),
    valid.replace("T12:00:00.000", "T99:00:00.000"),
    "# Journal v1\n\n## 2026-10-27\n",
    `${valid}\n## 2026-10-26\n\n## 2026-10-25\n`,
  ];
  for (const text of badFiles)
    assert.throws(() => parseJournal(text), Error, text);
  assert.throws(() => parseJournal(valid.repeat(201)), /journal/i);
});

test("bounds content by Unicode code points after normalization", () => {
  assert.equal(normalizeContent(`  ${"😀".repeat(500)}\n `), "😀".repeat(500));
  for (const input of ["", " \r\n\t", "x".repeat(501), "😀".repeat(501)]) {
    assert.throws(
      () => normalizeContent(input),
      /1 to 500 Unicode code points/,
    );
  }
});
