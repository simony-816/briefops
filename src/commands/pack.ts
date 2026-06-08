import path from "node:path";
import type { Command } from "commander";
import { packResume } from "../core/workflow.js";
import { parsePositiveInt } from "./shared.js";

function normalizeExportPolicy(value?: string): "local-private" | "shared-only" {
  const policy = (value ?? "local-private").trim().toLowerCase();
  if (policy === "local-private" || policy === "shared-only") {
    return policy;
  }

  throw new Error(`Invalid export policy: ${value}`);
}

export function registerPackCommands(program: Command): void {
  const pack = program
    .command("pack")
    .description("Create portable context packs for fresh AI coding threads.");

  pack
    .command("resume")
    .description("Create a self-contained resume pack markdown file.")
    .requiredOption("--worker <worker>", "Worker profile name.")
    .option("--project <project>", "Project name.")
    .requiredOption("--task <task>", "Next task.")
    .option("--budget <tokens>", "Resume token budget.", parsePositiveInt, 3000)
    .option("--export-policy <policy>", "local-private|shared-only", "local-private")
    .option("--output <path>", "Write the pack to a specific path.")
    .action(async (options: Record<string, unknown>) => {
      const result = await packResume({
        worker: options.worker as string,
        project: options.project as string | undefined,
        task: options.task as string,
        budget: options.budget as number,
        exportPolicy: normalizeExportPolicy(options.exportPolicy as string | undefined),
        outputPath: options.output
          ? path.resolve(process.cwd(), options.output as string)
          : undefined
      });
      console.log(`Saved portable resume pack: ${result.path}`);
      console.log(`Estimated tokens: ${result.tokens}`);
      if (result.warnings.length > 0) {
        console.log("");
        console.log("Warnings:");
        for (const warning of result.warnings) {
          console.log(`- ${warning}`);
        }
      }
    });
}
