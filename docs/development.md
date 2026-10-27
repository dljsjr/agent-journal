# Develop Journal

Use Node 24 or later. `mise.toml` selects Node LTS. Bun installs packages and runs development commands. Production uses only ordinary JavaScript dependencies and Node APIs.

```sh
bun install --frozen-lockfile
bun run check
bun run test
```

`check` runs strict TypeScript checking and Biome formatting and lint checks. `test` invokes Node's test runner on the source TypeScript. It refuses Bun or a Node version below 24. There is no compilation step. Use `node --test tests/format.test.ts` to run one file.

The suite creates temporary projects with isolated HOME, XDG, temporary, and journal directories. CLI children receive a small explicit environment. Store tests inject failures only at native file and subprocess boundaries. Concurrency tests use independent Node processes and the real platform lock utility. One lock timeout test takes 10 seconds.

The lock tests require macOS or Linux with the selected utility. Linux command support exists, but this implementation session did not execute Linux tests. See [HANDOFF.md](../HANDOFF.md) for verified platforms and remaining limits.

## Source map

| Module under `skills/journal/scripts/` | Responsibility |
| --- | --- |
| `journal.ts` | Commander arguments, directory selection, output and error reporting |
| `format.ts` | Entry normalization and complete versioned Markdown encoding and parsing |
| `dates.ts` | Local timestamps, native ISO date handling, and whole-input Chrono fallback |
| `selection.ts` | Pure author, day-window, limit, and omission selection |
| `store.ts` | Read-only loading and locked, bounded, atomic publication |

The data flow is arguments to typed selection or entry content, then journal storage, then output. Storage owns the lock descriptor and temporary file. The format parser refuses incomplete or unknown data before retention can discard old entries. No module detects a harness, infers identity, or imports another project.

The [specification](spec.md) defines behavior. The [format reference](format.md) defines serialized version 2, read-only version 1 compatibility, and locking mechanics. Local Trail tasks under project `JRN` record reviewed change IDs and verification evidence.
