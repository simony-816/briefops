import type { Command } from "commander";
import { addMemory, listMemory, showMemory, updateMemoryStatus } from "../core/memory.js";
import {
  applyMemoryProposal,
  listMemoryProposals,
  proposeMemoryFromLog,
  readMemoryProposal,
  rejectMemoryProposal
} from "../core/memoryProposal.js";
import { parseCommaList } from "../core/storage.js";
import { printTable } from "./shared.js";

export function registerMemoryCommands(program: Command): void {
  const memory = program.command("memory").description("Manage curated operational memory.");

  memory
    .command("propose-from-log <log>")
    .description("Create curated memory proposals from a work log id or latest.")
    .action(async (log: string) => {
      const result = await proposeMemoryFromLog({ fromLog: log });
      console.log(`Created memory proposal: ${result.proposal.id}`);
      console.log(result.path);
    });

  memory
    .command("proposal-list")
    .description("List memory proposals.")
    .option("--status <status>", "proposed|applied|rejected")
    .option("--project <project>", "Filter by project.")
    .option("--skill <skill>", "Filter by skill.")
    .action(async (options: Record<string, unknown>) => {
      const proposals = await listMemoryProposals({
        status: options.status as string | undefined,
        project: options.project as string | undefined,
        skill: options.skill as string | undefined
      });
      if (proposals.length === 0) {
        console.log("No memory proposals found.");
        return;
      }

      printTable([
        ["ID", "Status", "Project", "Skill", "Worker", "Items"],
        ...proposals.map((proposal) => [
          proposal.id,
          proposal.status,
          proposal.project ?? "",
          proposal.skill ?? "",
          proposal.worker ?? "",
          String(proposal.items.length)
        ])
      ]);
    });

  memory
    .command("proposal-show <id>")
    .description("Show a memory proposal.")
    .action(async (id: string) => {
      const proposal = await readMemoryProposal(process.cwd(), id);
      console.log(`ID: ${proposal.id}`);
      console.log(`Status: ${proposal.status}`);
      console.log(`From log: ${proposal.from_log}`);
      console.log(`Project: ${proposal.project ?? ""}`);
      console.log(`Skill: ${proposal.skill ?? ""}`);
      console.log(`Worker: ${proposal.worker ?? ""}`);
      console.log("");
      for (const item of proposal.items) {
        console.log(`- [${item.type}] ${item.content}`);
        if (item.rationale) {
          console.log(`  rationale: ${item.rationale}`);
        }
      }
    });

  memory
    .command("proposal-apply <id>")
    .description("Apply a memory proposal into curated memory.")
    .action(async (id: string) => {
      const result = await applyMemoryProposal({ id });
      console.log(`Applied memory proposal: ${result.proposal.id}`);
      console.log(`Created: ${result.created}`);
      console.log(`Skipped duplicates: ${result.skipped}`);
    });

  memory
    .command("proposal-reject <id>")
    .description("Reject a memory proposal without mutating memory.")
    .action(async (id: string) => {
      const proposal = await rejectMemoryProposal({ id });
      console.log(`Rejected memory proposal: ${proposal.id}`);
    });

  memory
    .command("apply-proposal <id>")
    .description("Alias for proposal-apply.")
    .action(async (id: string) => {
      const result = await applyMemoryProposal({ id });
      console.log(`Applied memory proposal: ${result.proposal.id}`);
      console.log(`Created: ${result.created}`);
      console.log(`Skipped duplicates: ${result.skipped}`);
    });

  memory
    .command("reject-proposal <id>")
    .description("Alias for proposal-reject.")
    .action(async (id: string) => {
      const proposal = await rejectMemoryProposal({ id });
      console.log(`Rejected memory proposal: ${proposal.id}`);
    });

  memory
    .command("add")
    .description("Add a curated memory item.")
    .requiredOption("--type <type>", "facts|decisions|lessons|incidents|deprecated")
    .option("--project <project>", "Project name.")
    .option("--skill <skill>", "Skill name.")
    .requiredOption("--content <content>", "Memory content.")
    .option("--status <status>", "active|stale|deprecated|superseded|archived", "active")
    .option("--tags <tags>", "Comma-separated tags.")
    .action(async (options: Record<string, unknown>) => {
      const item = await addMemory({
        type: options.type as string,
        project: options.project as string | undefined,
        skill: options.skill as string | undefined,
        content: options.content as string,
        status: options.status as string | undefined,
        tags: parseCommaList(options.tags as string | undefined)
      });
      console.log(`Added memory: ${item.id}`);
    });

  memory
    .command("list")
    .description("List memory items.")
    .option("--type <type>", "Memory category.")
    .option("--project <project>", "Filter by project.")
    .option("--skill <skill>", "Filter by skill.")
    .option("--status <status>", "Filter by status.")
    .option("--tag <tag>", "Filter by tag.")
    .action(async (options: Record<string, unknown>) => {
      const items = await listMemory({
        type: options.type as string | undefined,
        project: options.project as string | undefined,
        skill: options.skill as string | undefined,
        status: options.status as string | undefined,
        tag: options.tag as string | undefined
      });
      if (items.length === 0) {
        console.log("No memory items found.");
        return;
      }

      printTable([
        ["ID", "Type", "Status", "Project", "Skill", "Content"],
        ...items.map((item) => [
          item.id,
          item.type,
          item.status,
          item.project ?? "",
          item.skill ?? "",
          item.content
        ])
      ]);
    });

  memory
    .command("show <id>")
    .description("Show a memory item.")
    .action(async (id: string) => {
      const item = await showMemory(process.cwd(), id);
      printTable([
        ["Field", "Value"],
        ["ID", item.id],
        ["Type", item.type],
        ["Status", item.status],
        ["Project", item.project ?? ""],
        ["Skill", item.skill ?? ""],
        ["Content", item.content],
        ["Tags", item.tags.join(",")],
        ["Created", item.created_at]
      ]);
    });

  memory
    .command("update-status <id>")
    .description("Update a memory item status.")
    .requiredOption("--status <status>", "active|stale|deprecated|superseded|archived")
    .action(async (id: string, options: Record<string, unknown>) => {
      const item = await updateMemoryStatus({
        id,
        status: options.status as string
      });
      console.log(`Updated memory: ${item.id}`);
      console.log(`Status: ${item.status}`);
    });
}
