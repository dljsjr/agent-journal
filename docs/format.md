# Journal file format

Journal writes UTF-8 Markdown to `journal.md`. New files and CLI read output use version 2. Entries contain a small metadata prefix followed by ordinary prose.

```markdown
# Journal v2

## 2026-10-27
- [13:09:01.787-05:00] [NodeOnly] — Finished "date filters". Details: JRN-3
- [13:06:54.911-05:00] — Node-only installation works.
```

The [generated sample](sample-journal.md) contains actual CLI output from an isolated sandbox, not a hand-written approximation.

## Version 2 grammar

The first line is exactly `# Journal v2`. An empty journal contains only that line. Each day group starts with one blank line and a `## YYYY-MM-DD` header. Each entry occupies one physical list line:

```text
- [HH:MM:SS.mmm±HH:MM] [author] — content
- [HH:MM:SS.mmm±HH:MM] — content
```

The order and delimiters are fixed. Each separator space is one ASCII space. The separator before content is a literal em dash with one space on each side. Content extends to the end of the line. Brackets and em dashes inside content do not introduce metadata.

The author group is optional. `[]` means an explicitly empty author. Omitting the group means no attribution. Author labels preserve all whitespace and use exact, case-sensitive matching.

The time records milliseconds and a signed UTC offset. The required day header supplies the date. The full timestamp is the header date, `T`, and the time prefix. The offset never uses `Z`. Journal preserves timestamps rather than converting retained entries to the reader's timezone.

Entries stay in publication order, newest first. Adjacent entries from the same day share a header. Clock or timezone changes can produce repeated day headers without changing that order. Lines end with LF, including the final line.

## Text and escapes

Quotes, ordinary punctuation, Markdown, and Unicode text remain literal. Journal does not escape the entire body or wrap it in a data object. The parser extracts the fixed prefix and decodes only these escapes:

| Stored text | Decoded value | Location |
| --- | --- | --- |
| `\\` | One backslash | Author and content |
| `\]` | One closing bracket | Author only |
| `\uXXXX` | One UTF-16 code unit, with four lowercase hexadecimal digits | Restricted characters below |

The `\uXXXX` form is required for U+0000–U+001F, U+007F–U+009F, U+2028, U+2029, and lone UTF-16 surrogates. A lone surrogate is an unpaired code unit. A valid surrogate pair remains ordinary Unicode text, such as `😀`.

For example, an author containing a closing bracket, backslash, and newline appears as `[A\]\\B\u000a]`. The author is still one physical line. A literal `\u000a` in the original text appears as `\\u000a`, so it cannot become a newline during decoding.

Content normalization happens before encoding. Input line breaks become spaces, surrounding whitespace is removed, and other internal whitespace remains unchanged. An internal tab therefore appears as `\u0009`. The limit is 500 decoded Unicode code points, not 500 encoded characters.

Unknown escapes and unnecessary escapes are errors. For example, `\q`, `\u0061` for ordinary `a`, and `\]` in content are not canonical. Raw restricted characters are also errors. Decoding runs once, not recursively.

## Version 1 transition and parse refusal

Existing generated version 1 journals remain readable. Version 1 uses `# Journal v1`, the same day groups, and these entry lines:

```text
- `2026-10-27T12:34:56.789-05:00` {"content":"Finished date filters.","author":"Alice"}
```

The legacy JSON object contains `content`, followed by optional `author`, in that order. It uses compact `JSON.stringify` encoding, with U+0085, U+2028, and U+2029 also escaped. The legacy reader requires exact reconstruction of the original generated format.

Reads never convert or rewrite a file. CLI reads display selected entries in version 2, even when the source uses version 1. A normal write converts the file to version 2 under the existing lock and atomic replacement protocol. Conversion preserves every retained entry's content, author presence and value, timestamp, and publication order. The normal 200-entry retention limit still applies. Earlier Journal implementations cannot read version 2 files.

Journal parses the complete existing file before retention or replacement. Unknown versions, fields, lines, invalid UTF-8, empty day groups, and noncanonical formatting cause an error. Malformed data beyond the retention boundary still blocks a write. Failed parsing or replacement leaves the original journal bytes intact. A missing file represents an empty journal. An existing zero-byte file does not.

Do not hand-edit metadata or reformat the file. Journal refuses unrecognized files rather than replacing them with a partial parse. There is no migration command or filesystem sweep.

## Replacement and locking

Writers hold an advisory kernel lock through the entire read, parse, prepend, retention, and replacement operation. A unique temporary file in the journal directory receives the complete replacement. Rename atomically replaces `journal.md`. New journal files use mode `0600`, subject to the process umask.

The persistent `.journal.lock` sidecar holds no ownership metadata. Do not remove or replace it while writers can run. Node retains its open descriptor after `/usr/bin/lockf` on macOS or `/usr/bin/flock` on Linux exits. Lock acquisition waits at most 10 seconds. A missing utility causes an error without a fallback protocol.

Readers do not lock, create directories, or rewrite data. An atomic replacement lets a reader see either the old complete file or the new complete file. Direct manual edits bypass the advisory lock. This protocol covers cooperating writers on local filesystems, not network filesystems or power-loss durability.
