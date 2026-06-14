import type { Command } from "commander";
import {
  applySkillPatch,
  listSkillPatches,
  proposeSkillPatch,
  readSkillPatch,
  rejectSkillPatch,
  renderSkillPatchDiff
} from "../core/patch.js";
import { normalizeName } from "../core/paths.js";
import { createSkill, listSkills, readSkill, showSkill } from "../core/skill.js";
import { parseCommaList } from "../core/storage.js";
import { parsePositiveInt, printTable } from "./shared.js";

function extractChangelog(body: string): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+changelog\s*$/i.test(line.trim()));
  if (start === -1) {
    return "No changelog entries found.";
  }

  const section: string[] = [];
  for (const line of lines.slice(start)) {
    if (section.length > 0 && /^##\s+/.test(line.trim())) {
      break;
    }
    section.push(line);
  }

  return section.join("\n").trim();
}

export function registerSkillCommands(program: Command): void {
  const skill = program.command("skill").description("Manage reusable task skills.");

  skill
    .command("create <name>")
    .description("Create a skill markdown file.")
    .option("--description <description>", "Skill description.")
    .option("--tags <tags>", "Comma-separated tags.")
    .option("--max-tokens <tokens>", "Component token budget.", parsePositiveInt)
    .option("--force", "Overwrite an existing skill file.")
    .action(async (name: string, options: Record<string, unknown>) => {
      const result = await createSkill({
        name,
        description: options.description as string | undefined,
        tags: parseCommaList(options.tags as string | undefined),
        maxTokens: options.maxTokens as number | undefined,
        force: Boolean(options.force)
      });
      console.log(`Created skill: ${result.name}`);
      console.log(result.path);
    });

  skill
    .command("list")
    .description("List available skills.")
    .action(async () => {
      const skills = await listSkills(process.cwd());
      if (skills.length === 0) {
        console.log("No skills found.");
        return;
      }

      printTable([
        ["Name", "Version", "Max Tokens", "Tags", "Description"],
        ...skills.map((item) => [
          item.data.name,
          item.data.version,
          String(item.data.max_tokens),
          item.data.tags.join(","),
          item.data.description
        ])
      ]);
    });

  skill
    .command("show <name>")
    .description("Print a skill file.")
    .action(async (name: string) => {
      console.log(await showSkill(process.cwd(), name));
    });

  skill
    .command("history <name>")
    .description("Print the skill changelog section.")
    .action(async (name: string) => {
      const skillDocument = await readSkill(process.cwd(), name);
      console.log(extractChangelog(skillDocument.body));
    });

  skill
    .command("diff <name>")
    .description("Show patch proposals for a skill.")
    .action(async (name: string) => {
      const skillName = normalizeName(name);
      const patches = (await listSkillPatches(process.cwd())).filter(
        (patch) => patch.skill === skillName
      );
      if (patches.length === 0) {
        console.log("No patch proposals found for this skill.");
        return;
      }

      console.log(patches.map(renderSkillPatchDiff).join("\n"));
    });

  skill
    .command("propose-patch")
    .description("Create an explicit-review skill patch proposal from a work log lesson.")
    .requiredOption("--skill <skill>", "Skill name.")
    .option("--from-log <id>", "Work log id or latest.", "latest")
    .action(async (options: Record<string, unknown>) => {
      const result = await proposeSkillPatch({
        skill: options.skill as string,
        fromLog: options.fromLog as string | undefined
      });
      console.log(result.diff);
      console.error(`Saved patch: ${result.path}`);
    });

  skill
    .command("apply-patch <name>")
    .description("Apply a proposed skill patch and bump the skill patch version.")
    .requiredOption("--patch <patch>", "Patch id.")
    .action(async (name: string, options: Record<string, unknown>) => {
      const result = await applySkillPatch({
        skill: name,
        patch: options.patch as string
      });
      console.log(`Applied patch: ${result.patch.id}`);
      console.log(result.skillPath);
    });

  skill
    .command("reject-patch <patch>")
    .description("Reject a proposed skill patch.")
    .action(async (patch: string) => {
      const result = await rejectSkillPatch({ patch });
      console.log(`Rejected patch: ${result.id}`);
    });

  skill
    .command("patch-list")
    .description("List skill patch proposals.")
    .action(async () => {
      const patches = await listSkillPatches(process.cwd());
      if (patches.length === 0) {
        console.log("No skill patches found.");
        return;
      }

      printTable([
        ["ID", "Status", "Skill", "From Log", "Created"],
        ...patches.map((patch) => [
          patch.id,
          patch.status,
          patch.skill,
          patch.from_log,
          patch.created_at
        ])
      ]);
    });

  skill
    .command("patch-show <patch>")
    .description("Show a skill patch proposal.")
    .action(async (patch: string) => {
      const result = await readSkillPatch(process.cwd(), patch);
      console.log(renderSkillPatchDiff(result));
    });
}
