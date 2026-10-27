import { resolve } from "node:path";
import { Command, InvalidArgumentError, Option } from "commander";
import { parseDay } from "./dates.ts";
import { serializeJournal } from "./format.ts";
import { type Selection, selectEntries } from "./selection.ts";
import { readJournal, writeEntry } from "./store.ts";

interface CommonOptions {
  dir?: string;
  author?: string;
}

interface ReadOptions extends CommonOptions {
  date?: string;
  since?: string;
  limit: number;
}

function positiveInteger(input: string): number {
  const value = Number(input);
  if (!/^\d+$/.test(input) || !Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidArgumentError("Limit must be a positive safe integer.");
  }
  return value;
}

function directory(options: CommonOptions): string {
  return resolve(
    options.dir ?? process.env.AGENT_JOURNAL_DIR ?? ".agent-journal",
  );
}

const program = new Command()
  .name("journal")
  .description("A bounded activity journal for agent continuity.")
  .option(
    "--dir <path>",
    "journal directory (AGENT_JOURNAL_DIR or .agent-journal by default)",
  )
  .option("--author <label>", "explicit attribution or exact author filter");

program
  .command("write")
  .description("Record one entry, keeping the newest 200.")
  .argument("<entry>", "quoted content, at most 500 Unicode code points")
  .action((input: string, _options: unknown, command: Command) => {
    const options = command.optsWithGlobals<CommonOptions>();
    writeEntry(directory(options), input, options.author);
    process.stdout.write("Entry recorded.\n");
  });

program
  .command("read")
  .description("Read the newest matching recorded day without modifying it.")
  .addOption(
    new Option("--date <date>", "select one local calendar day").conflicts(
      "since",
    ),
  )
  .option("--since <date>", "select this local day and all later days")
  .option("--limit <n>", "maximum matching entries", positiveInteger, 20)
  .action((_options: unknown, command: Command) => {
    const options = command.optsWithGlobals<ReadOptions>();
    const selection: Selection = {
      author: options.author,
      limit: options.limit,
    };
    if (options.date !== undefined)
      selection.window = { kind: "date", day: parseDay(options.date) };
    if (options.since !== undefined)
      selection.window = { kind: "since", day: parseDay(options.since) };
    const result = selectEntries(readJournal(directory(options)), selection);
    process.stdout.write(
      result.entries.length
        ? serializeJournal(result.entries)
        : "No matching journal entries.\n",
    );
    if (result.omitted)
      process.stdout.write(
        `\nOmitted ${result.omitted} matching ${result.omitted === 1 ? "entry" : "entries"}.\n`,
      );
  });

try {
  program.parse();
} catch (error) {
  process.stderr.write(
    `journal: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
