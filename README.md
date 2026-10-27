# Agent Journal

A small, bounded Markdown journal for agent continuity, with concurrent publication by independent agents.

The CLI and skill are both named `journal`. They are harness agnostic.

The design is approved, but implementation has not started. Read [HANDOFF.md](HANDOFF.md) for current state and [docs/spec.md](docs/spec.md) for the v1 contract.

Node 24+ is the runtime baseline. `mise.toml` selects Node LTS, currently 24.22.1. Bun is a development preference, not a runtime requirement. The distribution goal is a source TypeScript script with no build step.
