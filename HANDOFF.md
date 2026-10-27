# Journal v1 session handoff

Updated: 2026-10-27.

The design discussion is complete enough to implement v1. Read [docs/spec.md](docs/spec.md) before making changes. It contains the approved contract, not an exploratory proposal.

## What we are doing

Replace the old standup workflow with a small bounded journal. A fresh agent context must quickly find where to resume, without loading a huge history. Independent top-level agents must be able to publish concurrently in the same directory.

The solution is a newest-first Markdown activity journal, not an identity layer, a complete memory system, or a parent/subagent coordination mechanism.

The repository is `agent-journal`. Both the CLI and skill are `journal`. Their behavior is harness agnostic.

## Repository state

The user initialized a colocated jj/Git repository and added `mise.toml` with `node = "lts"`, currently 24.22.1. That exact file was preserved and committed as jj change `qtorzlls`.

The repository otherwise contains only this handoff, the README, and the approved specification. There is no package manifest, CLI implementation, skill implementation, test suite, or project-local task board yet. Use jj for version control.

The earlier research and decision record are tracked in the Sandpiper repository as TOOLS-47 and TOOLS-50. Those are review/design records, not a backlog of authorized extra features.

## Approved contract at a glance

- Node-compatible TypeScript, Node 24+, no Bun API or Bun shebang requirement. A source script under the skill's `scripts/` directory is the distribution goal, without a build step.
- One required positional entry, quoted for multiword content. Replace line breaks with spaces, trim surrounding whitespace, then reject empty content or more than 500 content characters. Retain 200 entries, newest first, dropping the oldest on write and deleting empty day headers.
- Optional explicit `--author` attribution and author filtering. Default read selects the newest recorded day after author filtering, not necessarily today. Return at most 20 entries unless a positive `--limit` overrides it. Report omitted matching entries. Never consume or mutate on read.
- Mutually exclusive `--date` and inclusive `--since`. Explicit date selection overrides the latest-day default. Support ISO dates and common English relative dates. Use the machine's configured timezone for calendar days and include UTC offsets in generated timestamps.
- Directory precedence is `--dir`, then `AGENT_JOURNAL_DIR`, then `.agent-journal/` under CWD. Filename is fixed as `journal.md`. The earlier `--file` proposal was replaced, not retained as an additional setting.

## Date parsing decisions

Use an ISO-format fast path with native date handling, then Chrono for other expressions. Do not put unrestricted `Date.parse()` in front of everything.

The user explicitly declined additional calendar validation. JavaScript normalization of a date such as February 30 into March is acceptable. Do not reopen leap-year or month-length validation as a required feature.

Preserve local-calendar behavior for date-only ISO input. Blindly passing `YYYY-MM-DD` through `Date.parse()` interprets it as UTC midnight and can shift the local day backward.

The user offered the regex-first `parseYaamsTimestamp()` implementation in `pi-yaams` as a reference. It validates full timestamps with mandatory offsets and normalizes to UTC, so it is not a drop-in date-only parser.

Chrono 2.10.3 was tested under Node, using its English entry point. Its documented `strict` configuration excludes ordinary relative phrases, so that is not the whole CLI solution.

For the Chrono branch, require exactly one result, starting at index zero, with matched text equal to the trimmed argument and no range endpoint. The `end` field can be null or undefined. Use `parse()`, not `parseDate()`, to inspect those properties.

Whole-input matching prevents extraction from surrounding junk, but does not prove every fuzzy interpretation correct. Cover the promised phrases with fixed-reference tests. Chrono runs all configured parsers before refiners, so a custom ISO parser at the front does not implement short-circuit fallback. The user approved separate dispatch instead.

## The locking solution is already selected

Do not restart the native-addon/FFI/database investigation. The user chose shelling out to system utilities from ordinary Node APIs:

- `/usr/bin/lockf` on macOS.
- `/usr/bin/flock` on Linux. The user confirmed it exists on the Linux remotes in regular use.

The useful detail is file-descriptor inheritance. Node opens a persistent sidecar lock file and passes it as child descriptor 3 through `spawnSync`'s `stdio` array. The utility locks that descriptor and exits. Node's retained descriptor keeps the same kernel lock alive.

The verified macOS command shape is `lockf -s -t <seconds> 3`. Linux uses `flock -x -w <seconds> 3`. The timeout value is an implementation choice, not an approved new CLI flag.

The lock covers the entire journal read, complete parse, modification, trimming, and atomic replacement. Close the Node descriptor in `finally`. Use a unique temporary file in the journal directory.

Never unlink or replace the sidecar lock file. Its existence is not an ownership marker. macOS descriptor mode implies keeping it. Path-and-command mode needs `-k`.

This was verified on macOS: another process remained excluded after `lockf` exited, then acquired the lock after Node closed its descriptor. Linux execution has not been tested. Missing utilities must fail clearly, not fall back to a weaker lock-directory or stale-timeout protocol.

The scope is cooperating writers on local filesystems. Direct manual edits bypass advisory locks. Network-filesystem guarantees are not part of the agreed MVP.

## Skill and host integration

The skill should encourage short entries as meaningful developments occur, rather than one huge report at session end. Each entry discusses one thing. Detailed reasoning belongs in a task or document referenced by the entry. Routine tool calls do not each need an entry.

Metadata is generated by the CLI from flags and the clock. Agents do not hand-author it.

Sandpiper's separate integration supplies an absolute project `.sandpiper` directory through `AGENT_JOURNAL_DIR` before tool/provider children start. It preserves an existing user value. The standalone CLI and skill must not detect Sandpiper or import its code.

## Boundaries for the next session

No further product decisions were identified as blocking v1. The exact Markdown metadata format, character-counting implementation, author matching details, empty-file messages, and dependency installation layout can use simple documented defaults. Ask only if a real tradeoff appears.

Do not add edit/delete/cleanup commands, ownership recovery, process liveness, automatic retention by age, broad query languages, managed installers, publication machinery, or memory-system integration.

Leave the legacy `.sandpiper/standup.md` in the Sandpiper repository unchanged. It was deliberately not used for this handoff. No old-note migration or deletion is authorized.

The precise decommissioning of the old bundled CLI/skill and build wiring was not planned. Keep that separate from implementing the standalone tool and the already-approved environment-default integration.

No implementation was started during this session. Start from the approved contract and the user's next instruction, not from earlier speculative alternatives in the transcript.

## Verification already performed

The Sandpiper review and specification passed `bun check`, with zero warnings, before handoff. There is no application verification gate in this new repository yet.

Feasibility probes verified native Node TypeScript execution, macOS descriptor-lock retention, and Chrono's representative ISO/relative phrases. The actual journal still needs behavioral tests, especially concurrent writes, parser round-tripping, retention, filtering, and failure preservation. Run runtime-sensitive tests under Node even when Bun runs development commands.
