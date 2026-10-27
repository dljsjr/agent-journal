import { parse } from "chrono-node/en";

export function timestamp(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const local = new Date(date.getTime() + offset * 60_000)
    .toISOString()
    .slice(0, -1);
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${local}${offset < 0 ? "-" : "+"}${hours}:${minutes}`;
}

export function parseDay(input: string, reference = new Date()): string {
  const text = input.trim();
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    date = new Date(`${text}T12:00:00`);
  } else {
    const results = parse(text, reference);
    const result = results[0];
    if (
      results.length !== 1 ||
      !result ||
      result.index !== 0 ||
      result.text !== text ||
      result.end != null
    ) {
      throw new Error(`Invalid date: ${input}`);
    }
    date = result.start.date();
  }
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${input}`);
  return timestamp(date).slice(0, 10);
}
