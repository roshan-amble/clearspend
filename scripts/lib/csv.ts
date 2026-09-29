import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

export type CsvRow = Readonly<Record<string, string>>;

/** Reads a UTF-8 CSV file with a header row. A maintained parser handles quoted fields (brief section 7). */
export function readCsv(path: string): CsvRow[] {
  return parse(readFileSync(path, "utf-8"), { columns: true, skip_empty_lines: true, trim: false }) as CsvRow[];
}

function quote(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Writes rows as RFC 4180 CSV, with the columns in the given order. */
export function writeCsv(path: string, columns: readonly string[], rows: readonly CsvRow[]): void {
  const lines = [columns.join(","), ...rows.map((row) => columns.map((column) => quote(row[column] ?? "")).join(","))];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf-8");
}

/** Returns a required field, or throws with the file context. Never returns an empty default for a missing field. */
export function field(row: CsvRow, name: string, context: string): string {
  const value = row[name];
  if (value === undefined) {
    throw new Error(`${context}: missing column "${name}".`);
  }
  return value;
}

export function intField(row: CsvRow, name: string, context: string): number {
  const text = field(row, name, context);
  if (!/^\d+$/.test(text)) {
    throw new Error(`${context}: "${name}" must be a non-negative whole number, but it is "${text}".`);
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${context}: "${name}" is too large: ${text}.`);
  }
  return value;
}
