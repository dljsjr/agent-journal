# Agent Journal

A bounded Markdown activity journal for agent continuity. Independent agents can publish concurrently in the same directory. The CLI and skill are both named `journal` and contain no harness-specific behavior.

```sh
bun install --frozen-lockfile
node skills/journal/scripts/journal.ts write 'Finished date filters. Details: JRN-3'
node skills/journal/scripts/journal.ts read
```

Node 24+ runs the TypeScript source directly. Bun manages development dependencies but is not a runtime requirement. `mise.toml` preserves the Node LTS selection. Writers use `/usr/bin/lockf` on macOS or `/usr/bin/flock` on Linux.

Journal retains 200 entries, with at most 500 content code points each. Reads select the latest matching recorded day by default and return at most 20 entries. Author, date, and inclusive-since filters narrow the result.

- [Usage and dependency setup](docs/usage.md)
- [Journal skill](skills/journal/SKILL.md)
- [Approved behavior](docs/spec.md), [file format](docs/format.md), and [actual generated sample](docs/sample-journal.md)
- [Development](docs/development.md)
- [Current implementation handoff and verification limits](HANDOFF.md)
