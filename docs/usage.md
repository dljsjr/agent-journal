# Use Journal

Run Journal with Node 24 or later on macOS or Linux. Writers require `/usr/bin/lockf` on macOS or `/usr/bin/flock` from util-linux on Linux.

## Run from a checkout

1. Install dependencies from the repository root:

   ```sh
   bun install --frozen-lockfile
   ```

   Without Bun, use `npm install --omit=dev --package-lock=false`. Bun is not a runtime dependency.

2. Read the current project's latest recorded day:

   ```sh
   node /absolute/path/to/agent-journal/skills/journal/scripts/journal.ts read
   ```

3. Record one development:

   ```sh
   node /absolute/path/to/agent-journal/skills/journal/scripts/journal.ts write --author Alice 'Finished date filters. Details: JRN-3'
   ```

Keep the checkout and its root `node_modules` directory together. There is no build step. Point your harness's skill discovery at `skills/journal`. Copying `SKILL.md` alone does not install the script or its dependencies. Do not put the TypeScript source under `node_modules`. Node does not strip types there.

For a shorter command in fish, define a function with the absolute checkout path:

```fish
function journal
    node /absolute/path/to/agent-journal/skills/journal/scripts/journal.ts $argv
end
```

The following examples use that function.

## Choose the journal directory

The path comes from `--dir`, then `AGENT_JOURNAL_DIR`, then `.agent-journal` under the current working directory. Relative paths resolve from that working directory. An explicitly empty path means the working directory. The filename is always `journal.md`.

```fish
journal --dir /path/to/project/notes write 'Found the cause. Details: JRN-4'
```

To set the environment for one invocation, use the full Node command:

```sh
env AGENT_JOURNAL_DIR=/path/to/project/notes node /absolute/path/to/agent-journal/skills/journal/scripts/journal.ts read
```

## Read a selected window

```fish
journal read --author Alice
journal read --date 'last Friday'
journal read --since yesterday --limit 100
```

Without a date flag, Journal first filters authors, then selects the newest matching recorded calendar day. This is not necessarily today. Older days do not fill an incomplete result. `--date` selects one day. `--since` includes its day and all later days. The flags conflict.

Dates use the machine's timezone. Date-only ISO input uses `YYYY-MM-DD`. JavaScript calendar normalization applies, so `2026-02-30` selects March 2. Relative examples include `yesterday`, `last Monday`, `last Friday`, `2 days ago`, `2 weeks ago`, `last week`, `-3 days`, and `today - 2 days`. Quote phrases with spaces. For negative values, use `--date='-3 days'`. Journal rejects partial matches and date ranges. It does not promise GNU date compatibility.

Reads return at most 20 entries by default. `--limit` accepts a positive safe integer. The output reports omitted matches within the selected window. A missing journal or an empty result prints `No matching journal entries.` Reads do not consume entries, prune old entries, or create directories.

## Keep entries focused

`write` accepts exactly one quoted entry argument. Journal replaces line breaks with spaces and trims the result. Other internal whitespace remains unchanged. Content must contain 1 to 500 Unicode code points after normalization. This counts a supplementary Unicode character as one, but counts the parts of a combined emoji separately.

An optional `--author` label uses exact, case-sensitive matching. Journal preserves the label, including whitespace. It never infers an author from your login, environment, or harness. Omitting `--author` stores no attribution.

Each write keeps the newest 200 entries in publication order across all dates and authors. It drops older entries and their empty day headers. Idle time does not expire entries. Use a task or document for detailed reasoning, and reference it from a short entry.

If Journal reports an invalid file or failed lock, keep the file intact. It does not rewrite recognized fragments or switch to a weaker lock. See [the format reference](format.md) for generated metadata, parse refusal, and concurrency limits.
