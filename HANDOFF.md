# Journal implementation handoff

Updated: 2026-10-27.

The standalone CLI and skill implement the [approved behavior](docs/spec.md) with readable Markdown entries in format version 2. The [actual generated sample](docs/sample-journal.md) shows attributed and anonymous ordinary prose from the Node CLI.

The original version 1 implementation serialized JSON inside bullets. The lead approved that implementation and completed `JRN-1` as COMPLETE/DONE. User-reported task `JRN-6` tracks the correction to a small metadata prefix followed by prose. `JRN-1` remains complete.

## Current layout

The source entry point is `skills/journal/scripts/journal.ts`. Node 24+ runs it directly, without a build step or Bun runtime. Commander 14.0.3 and Chrono 2.10.3 are the production dependencies. Root dependency installation keeps the skill scripts within the checkout. `mise.toml` remains unchanged.

The [usage guide](docs/usage.md) covers invocation, dependency setup, filters, attribution, and directory precedence. The [format reference](docs/format.md) defines version 2 grammar and escapes, version 1 compatibility, full-file parse refusal, and descriptor locking.

Reads accept generated version 1 and version 2 files without mutation. CLI output uses version 2. A normal locked atomic write converts a completely parsed version 1 file and preserves all retained values. Unknown or partially parsed data still blocks publication. There is no migration command or filesystem sweep. The [development guide](docs/development.md) maps modules and verification commands.

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

The corrected suite passed 39 tests under Node 24.22.1 on macOS. The baseline version 1 suite passed 31 tests before edits. Earlier independent copied-source probes installed only Commander and Chrono, then ran the CLI without Bun on PATH. Current CLI tests also use Node alone with isolated HOME and XDG paths.

Tests cover readable stored/displayed prose, both format readers, Unicode and delimiter roundtrips, malformed-file and failed-replacement preservation, retention, and author/date/limit selection. They also cover fixed-reference dates, directory precedence, actual CLI execution, and concurrent independent writers. Transition tests preserve rich legacy values, reject malformed data beyond retention, and race sixteen CLI writers against a 240-entry version 1 journal. CLI subprocesses use temporary HOME, XDG, project, and temporary directories with an explicit environment.

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

The original adversarial reviewer approved all four version 1 slices and the complete implementation. The lead independently approved `ztzlkxry` and completed `JRN-1`.

The readable Markdown correction uses the same continuous developer/reviewer workflow. Bounded evidence lives in the descriptions for `JRN-7` (codec, `vuuxoxvs`), `JRN-8` (safe transition, `yxvrrvry`), and `JRN-9` (grammar and generated sample). The reviewer independently approved the codec and transition with no actionable findings. The pair reviewed actual file and CLI output, not only parsed values. Only `format.ts` changes production behavior. Dates, selection, storage, locking, and CLI arguments remain unchanged.

## Scope boundaries

There is no harness detection, inferred identity, Sandpiper environment integration, legacy-note migration or deletion, edit/delete/cleanup command, installer, publishing, or CI/release pipeline. No changes to another project's code or legacy standup files belong to this work.

Sandpiper tasks TOOLS-47 and TOOLS-50 remain historical design/review records. The selected lock mechanism is final for this scope. Do not reopen native-addon, FFI, or database research.
