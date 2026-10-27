export interface Entry {
  timestamp: string;
  content: string;
  author?: string;
}

export function serializeJournal(entries: readonly Entry[]): string {
  const lines = ["# Journal v2"];
  let day = "";
  for (const { timestamp, content, author } of entries) {
    const entryDay = timestamp.slice(0, 10);
    if (entryDay !== day) {
      lines.push("", `## ${entryDay}`);
      day = entryDay;
    }
    const attribution =
      author === undefined
        ? ""
        : ` [${escapeText(author).replace(/\]/gu, "\\]")}]`;
    lines.push(
      `- [${timestamp.slice(11)}]${attribution} — ${escapeText(content)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function escapeText(text: string): string {
  return text.replace(/[\\\p{Cc}\p{Cs}\u2028\u2029]/gu, (char) =>
    char === "\\"
      ? "\\\\"
      : `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function unescapeText(text: string): string {
  return text.replace(
    /\\(u[0-9a-f]{4}|[\\\]])/gu,
    (_match, sequence: string) =>
      sequence.startsWith("u")
        ? String.fromCharCode(Number.parseInt(sequence.slice(1), 16))
        : sequence,
  );
}

function serializeLegacyJournal(entries: readonly Entry[]): string {
  const lines = ["# Journal v1"];
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
  const title = lines.shift();
  if (title !== "# Journal v1" && title !== "# Journal v2")
    throw new Error("Unrecognized journal format.");
  const entries: Entry[] = [];
  let day = "";
  for (const line of lines) {
    if (line === "") continue;
    const header = /^## (\d{4}-\d{2}-\d{2})$/.exec(line);
    if (header) {
      day = header[1] ?? "";
      continue;
    }
    let entry: Entry;
    if (title === "# Journal v1") {
      entry = parseLegacyEntry(line);
    } else {
      const item =
        /^- \[(\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2})\](?: \[((?:\\.|[^\]\\])*)\])? — (.+)$/u.exec(
          line,
        );
      if (!item) throw new Error("Unrecognized journal entry.");
      entry = {
        timestamp: `${day}T${item[1]}`,
        content: unescapeText(item[3] ?? ""),
      };
      if (item[2] !== undefined) entry.author = unescapeText(item[2]);
    }
    if (
      !day ||
      !entry.timestamp.startsWith(day) ||
      Number.isNaN(new Date(entry.timestamp).getTime()) ||
      normalizeContent(entry.content) !== entry.content
    ) {
      throw new Error("Invalid journal entry metadata or content.");
    }
    entries.push(entry);
  }
  // Exact reconstruction rejects unknown fields, empty headers, and partial parses.
  const reconstructed =
    title === "# Journal v1"
      ? serializeLegacyJournal(entries)
      : serializeJournal(entries);
  if (reconstructed !== text)
    throw new Error("Unrecognized journal structure.");
  return entries;
}

function parseLegacyEntry(line: string): Entry {
  const item =
    /^- `(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2})` (.+)$/.exec(
      line,
    );
  if (!item) throw new Error("Unrecognized journal entry.");
  const payload: unknown = JSON.parse(item[2] ?? "");
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("content" in payload) ||
    typeof payload.content !== "string"
  )
    throw new Error("Invalid journal payload.");
  const entry: Entry = { timestamp: item[1] ?? "", content: payload.content };
  if ("author" in payload && typeof payload.author === "string")
    entry.author = payload.author;
  return entry;
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
