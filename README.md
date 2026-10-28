# Agent Journal

A bounded Markdown activity journal for agent continuity. Independent agents can publish concurrently in the same directory. The CLI and skill are both named `journal` and contain no harness-specific behavior.

```sh
bun install --frozen-lockfile
skills/journal/scripts/journal write 'Finished date filters. Details: JRN-3'
skills/journal/scripts/journal read
```

`journal` is an executable file with no extension. Run it directly, not as `node journal`. It needs Node 24+ on `PATH`. Node parses an extensionless entry point as JavaScript, so a small launcher imports the typed `cli.ts`. Node 24+ runs it without a build step. Bun manages development dependencies but is not a runtime requirement. `mise.toml` preserves the Node LTS selection. Writers use `/usr/bin/lockf` on macOS or `/usr/bin/flock` on Linux.

To use the skill in Pi, run `pi install /absolute/path/to/agent-journal` after the dependency install. See [the install steps](docs/usage.md#install-as-a-pi-package).

To use the skill in Claude Code, run `claude plugin marketplace add dljsjr/agent-journal`, then `claude plugin install agent-journal@agent-journal`. See [the install steps](docs/usage.md#install-as-a-claude-code-plugin).

Journal retains 200 entries, with at most 500 content code points each. Reads select the latest matching recorded day by default and return at most 20 entries. Author, date, and inclusive-since filters narrow the result.

- [Usage, dependency setup, and Pi and Claude Code installs](docs/usage.md)
- [Journal skill](skills/journal/SKILL.md)
- [Approved behavior](docs/spec.md), [file format](docs/format.md), and [actual generated sample](docs/sample-journal.md)
- [Development](docs/development.md)
- [Current implementation handoff and verification limits](HANDOFF.md)

## License

[MIT](LICENSE)
