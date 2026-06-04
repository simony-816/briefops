import { InvalidArgumentError } from "commander";

export function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("Expected a positive integer.");
  }

  return parsed;
}

export function collectRepeated(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function printTable(rows: string[][]): void {
  if (rows.length === 0) {
    return;
  }

  const widths = rows[0].map((_, column) =>
    Math.max(...rows.map((row) => row[column]?.length ?? 0))
  );

  for (const row of rows) {
    console.log(
      row
        .map((cell, index) => cell.padEnd(widths[index]))
        .join("  ")
        .trimEnd()
    );
  }
}
