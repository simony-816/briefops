import type { Command } from "commander";
import { initWorkspace } from "../core/workspace.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a local .briefops workspace.")
    .action(async () => {
      const result = await initWorkspace(process.cwd());
      console.log(`BriefOps workspace ready: ${result.root}`);
      console.log(`Created: ${result.created.length}`);
      console.log(`Existing: ${result.existing.length}`);
    });
}
