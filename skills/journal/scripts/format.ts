export interface Entry {
  timestamp: string;
  content: string;
  author?: string;
}

const title = "# Journal v1";

export function serializeJournal(entries: readonly Entry[]): string {
  const lines = [title];
  let day = "";
  for (const { timestamp, content, author } of entries) {
    const entryDay = timestamp.slice(0, 10);
    if (entryDay !== day) {
      lines.push("", `## ${entryDay}`);
      day = entryDay;
    }
    const payload = JSON.stringify({ content, author }).replace(
      /[\u0085\u2028\u2029]/gu,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
    lines.push(`- \`${timestamp}\` ${payload}`);
  }
  return `${lines.join("\n")}\n`;
}

export function parseJournal(text: string): Entry[] {
  const lines = text.split("\n");
  if (lines.shift() !== title) throw new Error("Unrecognized journal format.");
  const entries: Entry[] = [];
  let day = "";
  for (const line of lines) {
    if (line === "") continue;
    const header = /^## (\d{4}-\d{2}-\d{2})$/.exec(line);
    if (header) {
      day = header[1] ?? "";
      continue;
    }
    const item =
      /^- `(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2})` (.+)$/.exec(
        line,
      );
    if (!item || !day) throw new Error("Unrecognized journal entry.");
    const payload: unknown = JSON.parse(item[2] ?? "");
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("content" in payload) ||
      typeof payload.content !== "string"
    ) {
      throw new Error("Invalid journal payload.");
    }
    const timestamp = item[1] ?? "";
    if (
      !timestamp.startsWith(day) ||
      Number.isNaN(new Date(timestamp).getTime()) ||
      normalizeContent(payload.content) !== payload.content
    ) {
      throw new Error("Invalid journal entry metadata or content.");
    }
    const entry: Entry = { timestamp, content: payload.content };
    if ("author" in payload && typeof payload.author === "string")
      entry.author = payload.author;
    entries.push(entry);
  }
  // Exact reconstruction rejects unknown fields, empty headers, and partial parses.
  if (serializeJournal(entries) !== text)
    throw new Error("Unrecognized journal structure.");
  return entries;
}

export function normalizeContent(input: string): string {
  const content = input.replace(/\r\n|[\r\n\u0085\u2028\u2029]/gu, " ").trim();
  const length = [...content].length;
  if (length < 1 || length > 500) {
    throw new Error(
      "Entry must contain 1 to 500 Unicode code points after normalization.",
    );
  }
  return content;
}
