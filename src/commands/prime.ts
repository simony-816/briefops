import type { Command } from "commander";
import { normalizeExportPolicy } from "../core/exportPolicy.js";
import { primeContext, type PrimeContextOptions } from "../core/prime.js";
import { parsePositiveInt } from "./shared.js";

function normalizeFormat(value?: string): PrimeContextOptions["format"] {
  const format = (value ?? "markdown").trim().toLowerCase();
  if (format === "markdown" || format === "codex") {
    return format;
  }

  throw new Error(`Invalid prime format: ${value}`);
}

export async function runPrimeCommand(
  options: Record<string, unknown>,
  overrides: Partial<PrimeContextOptions> = {}
): Promise<void> {
  const result = await primeContext({
    worker: options.worker as string | undefined,
    project: options.project as string | undefined,
    task: options.task as string | undefined,
    maxTokens: options.maxTokens as number | undefined,
    format: overrides.format ?? normalizeFormat(options.format as string | undefined),
    exportPolicy:
      overrides.exportPolicy ??
      normalizeExportPolicy(options.exportPolicy as string | undefined)
  });

  console.log(result.content);
  console.error(`Estimated tokens: ${result.tokens}`);
  if (result.warnings.length > 0) {
    console.error("Warnings:");
    for (const warning of result.warnings) {
      console.error(`- ${warning}`);
    }
  }
}

export function registerPrimeCommand(program: Command): void {
  program
    .command("prime")
    .description("Print compact BriefOps context for starting a fresh AI coding thread.")
    .option("--worker <worker>", "Worker profile name.")
    .option("--project <project>", "Project name.")
    .option("--task <task>", "Current task.")
    .option("--max-tokens <tokens>", "Prime context token budget.", parsePositiveInt, 800)
    .option("--format <format>", "markdown|codex", "markdown")
    .option("--export-policy <policy>", "local-private|shared-only", "local-private")
    .action(async (options: Record<string, unknown>) => {
      await runPrimeCommand(options);
    });
}
