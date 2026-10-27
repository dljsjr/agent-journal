import assert from "node:assert/strict";
import fs from "node:fs";
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

test("writes readable prose with a fixed prefix and distinct empty or absent authors", () => {
  assert.equal(
    serializeJournal([
      {
        timestamp: "2026-10-27T13:09:01.787-05:00",
        content: 'Finished "date filters". Details: JRN-3',
        author: "NodeOnly",
      },
      {
        timestamp: "2026-10-27T13:06:54.911-05:00",
        content: "Node-only installation works.",
      },
      {
        timestamp: "2026-10-27T13:00:00.000-05:00",
        content: "Explicit empty attribution.",
        author: "",
      },
    ]),
    '# Journal v2\n\n## 2026-10-27\n- [13:09:01.787-05:00] [NodeOnly] — Finished "date filters". Details: JRN-3\n- [13:06:54.911-05:00] — Node-only installation works.\n- [13:00:00.000-05:00] [] — Explicit empty attribution.\n',
  );
});

test("reads v2 prose with day-derived timestamps and optional attribution", () => {
  const text =
    '# Journal v2\n\n## 2026-10-27\n- [13:09:01.787-05:00] [NodeOnly] — Finished "date filters".\n- [13:06:54.911-05:00] — Anonymous [notes] — done.\n- [13:00:00.000-05:00] [] — Empty label.\n';
  assert.deepEqual(parseJournal(text), [
    {
      timestamp: "2026-10-27T13:09:01.787-05:00",
      content: 'Finished "date filters".',
      author: "NodeOnly",
    },
    {
      timestamp: "2026-10-27T13:06:54.911-05:00",
      content: "Anonymous [notes] — done.",
    },
    {
      timestamp: "2026-10-27T13:00:00.000-05:00",
      content: "Empty label.",
      author: "",
    },
  ]);
});

test("escapes only author delimiters, backslashes, controls, and lone surrogates", () => {
  const entry: Entry = {
    timestamp: "2026-10-27T12:34:56.789-05:00",
    content:
      'He said "done"; [notes] — C:\\work 😀\t\u0000\u007f\u009f\ud800 end',
    author: "A] — [B\\C\n😀\udfff",
  };
  const text = String.raw`# Journal v2

## 2026-10-27
- [12:34:56.789-05:00] [A\] — [B\\C\u000a😀\udfff] — He said "done"; [notes] — C:\\work 😀\u0009\u0000\u007f\u009f\ud800 end
`;
  assert.equal(serializeJournal([entry]), text);
  assert.deepEqual(parseJournal(text), [entry]);
  assert.deepEqual(parseJournal(Buffer.from(text).toString("utf8")), [entry]);
  const literal = { ...entry, content: String.raw`literal \u000a and \] end` };
  assert.deepEqual(parseJournal(serializeJournal([literal])), [literal]);
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
    valid.replace("v2", "v99"),
    `${valid}unrecognized suffix\n`,
    valid.replace(" — kept", " — "),
    valid.replace("kept", " leading space"),
    valid.replace("kept", "trailing space "),
    valid.replace("kept", String.raw`line\u000afeed`),
    valid.replace("kept", "x".repeat(501)),
    valid.replace("12:00:00.000-05:00", "12:00:00.000"),
    valid.replace("12:00:00.000", "99:00:00.000"),
    valid.replace("12:00:00.000", "2026-10-27T12:00:00.000"),
    valid.replace(" — ", " - "),
    valid.replace(" — kept", " [unclosed — kept"),
    valid.replace(" — kept", " [first] [second] — kept"),
    ...[
      String.raw`\q`,
      String.raw`\]`,
      String.raw`\u006b`,
      String.raw`\u000A`,
      String.raw`\ud83d\ude00`,
      "\t",
      "\u0000",
      "\u007f",
      "\u009f",
      "\u2028",
      "\u2029",
      "\ud800",
    ].map((sequence) => valid.replace("kept", `kept${sequence}end`)),
    valid.replace(" — kept", String.raw` [author\q] — kept`),
    valid.replace(" — kept", " [author\n] — kept"),
    "# Journal v2\n\n## 2026-10-27\n",
    `${valid}\n## 2026-10-26\n\n## 2026-10-25\n`,
  ];
  for (const text of badFiles)
    assert.throws(() => parseJournal(text), Error, text);
  assert.throws(() => parseJournal(valid.repeat(201)), /journal/i);
});

test("reads canonical v1 data losslessly and rejects unknown or partial legacy data", () => {
  const legacy = fs.readFileSync(
    new URL("./fixtures/journal-v1.md", import.meta.url),
    "utf8",
  );
  const entries: Entry[] = [
    {
      timestamp: "2026-10-27T13:09:01.787-05:00",
      content: 'Finished "date filters". Details: JRN-3',
      author: "A] — [B\\C\n😀\udfff",
    },
    {
      timestamp: "2026-10-27T13:06:54.911-05:00",
      content:
        "Literal \\u000a, brackets [notes], controls \u0000\t and lone \ud800 end.",
      author: "",
    },
    {
      timestamp: "2026-10-26T00:00:00.000+14:00",
      content: "Anonymous ordinary prose.",
    },
    {
      timestamp: "2026-10-27T01:00:00.000-04:00",
      content: "Rollback retains publication order.",
      author: "\r\n\u0085\u2028\u2029",
    },
  ];
  assert.deepEqual(parseJournal(legacy), entries);
  assert.deepEqual(parseJournal(serializeJournal(entries)), entries);
  assert.deepEqual(parseJournal("# Journal v1\n"), []);
  for (const text of [
    legacy.replace("v1", "v3"),
    `${legacy}unknown suffix\n`,
    legacy.replace('"author":""', '"author":null'),
    legacy.replace('"author":""', '"author":"","unknown":1'),
    legacy.replace('"author":""', '"unknown":1'),
    legacy.replace("## 2026-10-26", "## 2026-10-25"),
    legacy.replace("13:09:01", "99:09:01"),
    legacy.replace('"Anonymous ordinary prose."', '" leading space"'),
    legacy.replace('"Anonymous ordinary prose."', '"line\\nfeed"'),
    legacy.replace(
      '"Anonymous ordinary prose."',
      JSON.stringify("x".repeat(501)),
    ),
    legacy.replace('"Anonymous ordinary prose."', '""'),
    legacy.replace('"content":', '"unknown":'),
    legacy.replace("\\ud800", "\\uD800"),
    `${legacy}\n## 2026-10-25\n`,
  ])
    assert.throws(() => parseJournal(text), Error, text);
});

test("round trips a deterministic Unicode and delimiter corpus without changing entry order", () => {
  const fragments = [
    "<",
    ">",
    "-",
    "#",
    "`",
    '"',
    "\\",
    "] — [",
    "\t",
    "\u0000",
    "😀",
    "é",
    "\ud800",
  ];
  const entries: Entry[] = Array.from({ length: 240 }, (_, index) => ({
    timestamp: `2026-10-${index % 2 ? "26" : "27"}T12:00:00.000+00:00`,
    content: `entry ${index}: ${fragments.map((_, part) => fragments[(index + part) % fragments.length]).join("")} end`,
    author: `${index}\n\r\u2028\u2029${fragments.join("")}`,
  }));
  assert.deepEqual(parseJournal(serializeJournal(entries)), entries);
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
