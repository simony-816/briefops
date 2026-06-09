import type { Command } from "commander";
import { compareContext } from "../core/contextCompare.js";
import { normalizeExportPolicy } from "../core/exportPolicy.js";
import { parsePositiveInt } from "./shared.js";

export function registerCompareCommands(program: Command): void {
  const compare = program.command("compare").description("Compare BriefOps context shapes.");

  compare
    .command("context")
    .description("Compare raw local candidate context with compiled prime context.")
    .option("--worker <worker>", "Worker profile name.")
    .option("--project <project>", "Project name.")
    .requiredOption("--task <task>", "Current task.")
    .option("--max-tokens <tokens>", "Prime context token budget.", parsePositiveInt, 800)
    .option("--export-policy <policy>", "local-private|shared-only", "local-private")
    .action(async (options: Record<string, unknown>) => {
      const result = await compareContext({
        worker: options.worker as string | undefined,
        project: options.project as string | undefined,
        task: options.task as string,
        maxTokens: options.maxTokens as number,
        exportPolicy: normalizeExportPolicy(options.exportPolicy as string | undefined)
      });

      console.log("BriefOps Context Comparison");
      console.log("");
      console.log("Raw candidate context:");
      console.log(`- project file: ${result.raw.projectTokens} tokens`);
      console.log(`- worker summary: ${result.raw.workerSummaryTokens} tokens`);
      console.log(`- active memory: ${result.raw.activeMemoryTokens} tokens`);
      console.log(`- recent logs: ${result.raw.recentLogTokens} tokens`);
      console.log(`Estimated raw total: ${result.raw.totalTokens} tokens`);
      console.log("");
      console.log("Compiled prime:");
      console.log(`- estimated prime total: ${result.prime.tokens} tokens`);
      console.log(`- max tokens: ${result.prime.maxTokens}`);
      console.log(`- export policy: ${result.prime.exportPolicy}`);
      console.log("");
      console.log("Reduction:");
      console.log(`- saved: ~${result.savedTokens} tokens`);
      console.log(`- compression: ${result.compressionPercent}%`);
      if (result.warnings.length > 0) {
        console.log("");
        console.log("Warnings:");
        for (const warning of result.warnings) {
          console.log(`- ${warning}`);
        }
      }
    });
}
