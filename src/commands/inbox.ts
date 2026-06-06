import type { Command } from "commander";
import { getInboxSummary } from "../core/inbox.js";

export function registerInboxCommand(program: Command): void {
  program
    .command("inbox")
    .description("Summarize the local BriefOps operational queue.")
    .option("--project <project>", "Filter by project.")
    .option("--worker <worker>", "Filter by worker.")
    .option("--skill <skill>", "Filter by skill.")
    .action(async (options: Record<string, unknown>) => {
      const summary = await getInboxSummary({
        project: options.project as string | undefined,
        worker: options.worker as string | undefined,
        skill: options.skill as string | undefined
      });

      console.log("BriefOps Inbox");
      console.log("");
      console.log("Pending:");
      console.log(`- memory proposals: ${summary.pendingMemoryProposals}`);
      console.log(`- skill patches: ${summary.pendingSkillPatches}`);
      console.log("");
      console.log("Open Risks:");
      console.log(`- ${summary.openRisks} unresolved risk item(s) found in recent logs`);
      if (summary.staleMemory > 0 || summary.deprecatedMemory > 0) {
        console.log("");
        console.log("Memory Maintenance:");
        console.log(`- stale memory: ${summary.staleMemory}`);
        console.log(`- deprecated memory: ${summary.deprecatedMemory}`);
      }
      console.log("");
      console.log("Recommended:");
      for (const command of summary.recommendedCommands) {
        console.log(`- ${command}`);
      }
    });
}
