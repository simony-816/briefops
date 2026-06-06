import path from "node:path";
import type { Command } from "commander";
import { continueWork } from "../core/workflow.js";
import { parsePositiveInt } from "./shared.js";

export function registerContinueCommand(program: Command): void {
  program
    .command("continue")
    .description("Continue work: check continuity, refresh worker, generate handoff, and save a Codex resume prompt.")
    .option("--project <project>", "Project name. Defaults to the worker project.")
    .requiredOption("--worker <worker>", "Worker profile name.")
    .requiredOption("--task <task>", "Next task.")
    .option("--budget <tokens>", "Resume token budget.", parsePositiveInt, 3000)
    .option("--mode <mode>", "loop|execute|plan", "loop")
    .option("--completion-promise <text>", "Concrete completion promise.")
    .option("--output <path>", "Write the resume prompt to a specific path.")
    .option("--pack", "Also save a self-contained portable resume pack.")
    .action(async (options: Record<string, unknown>) => {
      const result = await continueWork({
        project: options.project as string | undefined,
        worker: options.worker as string,
        task: options.task as string,
        budget: options.budget as number,
        mode: options.mode as string | undefined,
        completionPromise: options.completionPromise as string | undefined,
        outputPath: options.output
          ? path.resolve(process.cwd(), options.output as string)
          : undefined,
        pack: Boolean(options.pack)
      });

      console.log(`Continuity readiness: ${result.readiness}`);
      if (result.warnings.length > 0) {
        console.log("");
        console.log("Warnings:");
        for (const warning of result.warnings) {
          console.log(`- ${warning}`);
        }
      }
      if (result.pendingMemoryProposals > 0) {
        console.log("");
        console.log("Pending memory proposals should be reviewed before continuing.");
        console.log("");
        console.log("Review:");
        console.log("briefops memory proposal-list --status proposed");
        console.log("briefops memory proposal-show latest");
        console.log("");
        console.log("Apply if appropriate:");
        console.log("briefops memory proposal-apply latest");
        console.log("");
        console.log("Reject if not useful:");
        console.log("briefops memory proposal-reject latest");
      }
      console.log("");
      console.log(`Refreshed worker summary: ${result.workerSummaryPath}`);
      if (result.handoffPath) {
        console.log(`Saved handoff: ${result.handoffPath}`);
      }
      if (result.resumePath) {
        console.log(`Saved Codex resume: ${result.resumePath}`);
      }
      if (result.packPath) {
        console.log(`Saved portable resume pack: ${result.packPath}`);
      }
    });
}
