import type { Command } from "commander";
import { inspectContinuityObservability } from "../core/observability.js";
import { normalizeExportPolicy } from "../core/exportPolicy.js";
import { parsePositiveInt } from "./shared.js";

export function registerObsCommands(program: Command): void {
  const obs = program.command("obs").description("Inspect BriefOps continuity observability.");

  obs
    .command("continuity")
    .description("Report context compression, continuity health, queues, and memory hygiene.")
    .option("--worker <worker>", "Worker profile name.")
    .option("--project <project>", "Project name.")
    .requiredOption("--task <task>", "Current task.")
    .option("--max-tokens <tokens>", "Prime context token budget.", parsePositiveInt, 800)
    .option("--export-policy <policy>", "local-private|shared-only", "local-private")
    .option("--json", "Print JSON output.")
    .action(async (options: Record<string, unknown>) => {
      const result = await inspectContinuityObservability({
        worker: options.worker as string | undefined,
        project: options.project as string | undefined,
        task: options.task as string,
        maxTokens: options.maxTokens as number,
        exportPolicy: normalizeExportPolicy(options.exportPolicy as string | undefined)
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log("BriefOps Continuity Observability");
      console.log("");
      console.log(`Worker: ${result.worker}`);
      console.log(`Project: ${result.project}`);
      console.log(`Readiness: ${result.continuity.readiness}`);
      console.log("");
      console.log("Context:");
      console.log(`- raw candidate total: ${result.context.raw.totalTokens} tokens`);
      console.log(`- prime total: ${result.context.prime.tokens} tokens`);
      console.log(`- saved: ~${result.context.savedTokens} tokens`);
      console.log(`- compression: ${result.context.compressionPercent}%`);
      console.log("");
      console.log("Queues:");
      console.log(`- pending memory proposals: ${result.queues.pendingMemoryProposals}`);
      console.log(`- pending skill patches: ${result.queues.pendingSkillPatches}`);
      console.log(`- open risks: ${result.queues.openRisks}`);
      console.log("");
      console.log("Memory hygiene:");
      console.log(`- warnings: ${result.hygiene.warnings.length}`);
      console.log(`- duplicate-like groups: ${result.hygiene.duplicateLike}`);
      console.log(`- potential decision conflicts: ${result.hygiene.potentialConflicts}`);
      console.log(`- old active items: ${result.hygiene.oldActive}`);
    });
}
