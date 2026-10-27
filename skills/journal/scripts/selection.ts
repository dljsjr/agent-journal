import type { Entry } from "./format.ts";

export interface Selection {
  author?: string;
  limit?: number;
  window?: { kind: "date" | "since"; day: string };
}

export function selectEntries(
  entries: readonly Entry[],
  options: Selection = {},
): { entries: Entry[]; omitted: number } {
  const matching = entries.filter(
    (entry) => options.author === undefined || entry.author === options.author,
  );
  const day =
    options.window?.day ??
    matching.reduce(
      (latest, entry) =>
        entry.timestamp.slice(0, 10) > latest
          ? entry.timestamp.slice(0, 10)
          : latest,
      "",
    );
  const selected = matching.filter((entry) =>
    options.window?.kind === "since"
      ? entry.timestamp.slice(0, 10) >= day
      : entry.timestamp.startsWith(day),
  );
  const visible = selected.slice(0, options.limit ?? 20);
  return { entries: visible, omitted: selected.length - visible.length };
}
