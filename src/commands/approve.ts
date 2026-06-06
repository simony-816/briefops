import type { Command } from "commander";
import {
  approveAny,
  approveMemory,
  approveSkillPatch,
  type ApproveResult
} from "../core/approval.js";

function printApproval(result: ApproveResult): void {
  if (result.kind === "memory") {
    console.log(`Applied memory proposal: ${result.proposal.id}`);
    console.log(`Created: ${result.created}`);
    console.log(`Skipped duplicates: ${result.skipped}`);
    return;
  }

  console.log(`Applied skill patch: ${result.patch.id}`);
  console.log(result.skillPath);
}

export function registerApproveCommand(program: Command): void {
  const approve = program
    .command("approve")
    .description("Approve a proposed memory item or skill patch.");

  approve
    .argument("[id]", "Memory proposal or skill patch id, or latest.")
    .action(async (id?: string) => {
      if (!id) {
        approve.help({ error: true });
        return;
      }
      printApproval(await approveAny({ id }));
    });

  approve
    .command("memory <id>")
    .description("Apply a memory proposal.")
    .action(async (id: string) => {
      printApproval(await approveMemory({ id }));
    });

  approve
    .command("skill-patch <id>")
    .description("Apply a skill patch proposal.")
    .action(async (id: string) => {
      printApproval(await approveSkillPatch({ id }));
    });
}
