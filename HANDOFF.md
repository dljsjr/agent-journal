# Journal v1 implementation handoff

Updated: 2026-10-27.

The standalone CLI and skill implement the [approved v1 contract](docs/spec.md). The implementation awaits final lead review under local Trail task `JRN-1`. The user delegated final task completion to the lead. The developer/reviewer pair does not finalize that top-level task.

## Current layout

The source entry point is `skills/journal/scripts/journal.ts`. Node 24+ runs it directly, without a build step or Bun runtime. Commander 14.0.3 and Chrono 2.10.3 are the production dependencies. Root dependency installation keeps the skill scripts within the checkout. `mise.toml` remains unchanged.

The [usage guide](docs/usage.md) covers invocation, dependency setup, filters, attribution, and directory precedence. The [format reference](docs/format.md) defines version 1, full-file parse refusal, and descriptor locking. The [development guide](docs/development.md) maps modules and verification commands.

Mechanical defaults are Unicode code point counting, exact case-sensitive author matching, a 10-second lock wait, and `No matching journal entries.` for an empty read. Empty author labels remain distinct from absent attribution. An explicitly empty directory path means the invocation's current directory.

Publication order remains immutable. Adjacent entries share a day header. Clock or timezone rollback can repeat a header. Default reads select the maximum recorded calendar day after author filtering, then preserve publication order within that selection.

## Verification

Run these commands from the checkout:

```sh
bun install --frozen-lockfile
bun run check
bun run test
```

`check` runs strict TypeScript and Biome with zero warnings. `test` executes the TypeScript source through Node's test runner. Test helpers reject Bun and Node versions below 24.

The final suite passed 31 tests under Node 24.22.1 on macOS. Independent copied-source probes installed only Commander and Chrono, then ran the CLI without Bun on PATH.

Tests cover full serialization roundtrips, malformed-file and failed-replacement preservation, retention, author/date/limit selection, fixed-reference date handling, directory precedence, actual CLI execution, and concurrent independent writers. CLI subprocesses use temporary HOME, XDG, project, and temporary directories with an explicit environment.

Actual macOS tests exercise the persistent descriptor lock after the utility exits, lock release, a bounded acquisition timeout, concurrent publication, and the retention ceiling. Narrow native-API failure injection covers missing utilities and rename failure. The reviewer also tested partial temporary writes, slow replacement, and simultaneous reads.

Linux locking support uses `/usr/bin/flock`, but this implementation session did not execute Linux tests. No authorized local Linux runtime was available. Do not report Linux execution as verified. Guarantees cover cooperating writers on local filesystems, not network filesystems, manual edits, or power-loss durability.

## Review record

Local Trail project `JRN` owns the work. Subtask descriptions preserve bounded review evidence and stable change IDs:

| Task | Slice | Reviewed change |
| --- | --- | --- |
| `JRN-2` | Versioned Markdown codec and Node development setup | `nosooour` |
| `JRN-3` | Local dates and pure read selection | `sklqmuyp` |
| `JRN-4` | Atomic descriptor-locked storage | `pqxrvvqv` |
| `JRN-5` | Source CLI, skill, and usage documentation | `mnmlvrmx` |

The adversarial reviewer approved all four slices and the complete implementation without actionable findings or unresolved blockers. Task `JRN-1` awaits lead review. The pair prioritized readable cohesive modules alongside behavioral correctness.

## Scope boundaries

There is no harness detection, inferred identity, Sandpiper environment integration, legacy-note migration or deletion, edit/delete/cleanup command, installer, publishing, or CI/release pipeline. No changes to another project's code or legacy standup files belong to this work.

Sandpiper tasks TOOLS-47 and TOOLS-50 remain historical design/review records. The selected lock mechanism is final for this scope. Do not reopen native-addon, FFI, or database research.
