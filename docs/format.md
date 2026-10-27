# Journal file format

Journal writes UTF-8 Markdown to `journal.md`. The first line identifies format version 1. Blank lines precede day headers. Each entry occupies one physical list line.

```markdown
# Journal v1

## 2026-10-27
- `2026-10-27T12:34:56.789-05:00` {"content":"Finished date filters. Details: JRN-3","author":"Alice"}
- `2026-10-27T11:00:00.000-05:00` {"content":"Found the failure case."}
```

The timestamp records local time, milliseconds, and the UTC offset at publication. The header uses the timestamp's calendar date. Journal groups adjacent entries from the same day. Clock or timezone changes can produce repeated day headers without changing publication order.

The JSON object contains `content` and an optional `author`. JSON escaping preserves quotes, backslashes, control characters, and author labels with line breaks. Journal also escapes U+0085, U+2028, and U+2029. An absent author differs from an empty author label.

The parser reads the complete file before a write can drop old entries. It requires exact reconstruction in the generated format. Unknown versions, fields, lines, invalid UTF-8, empty day headers, and noncanonical formatting cause an error. A missing file represents an empty journal. An existing zero-byte file does not.

Do not hand-edit generated metadata or reformat the file. Journal refuses unrecognized files rather than replacing them with a partial parse. There is no automatic format migration. A future format needs an explicit version reader or conversion before it can replace version 1.

## Replacement and locking

Writers hold an advisory kernel lock through the entire read, parse, prepend, retention, and replacement operation. A unique temporary file in the journal directory receives the complete replacement. Rename atomically replaces `journal.md`. New journal files use mode `0600`, subject to the process umask.

The persistent `.journal.lock` sidecar holds no ownership metadata. Do not remove or replace it while writers can run. Node retains its open descriptor after `/usr/bin/lockf` on macOS or `/usr/bin/flock` on Linux exits. Lock acquisition waits at most 10 seconds. A missing utility causes an error without a fallback protocol.

Readers do not lock, create directories, or rewrite data. An atomic replacement lets a reader see either the old complete file or the new complete file. Direct manual edits bypass the advisory lock. This protocol covers cooperating writers on local filesystems, not network filesystems or power-loss durability.
