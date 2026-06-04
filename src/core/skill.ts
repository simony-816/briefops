import { BriefOpsError } from "./errors.js";
import { normalizeName, skillFilePath, workspacePaths } from "./paths.js";
import {
  listFilesBySuffix,
  parseMarkdownWithFrontmatter,
  readTextFile,
  stringifyMarkdownWithFrontmatter,
  writeTextFile
} from "./storage.js";
import { requireWorkspace } from "./workspace.js";
import { skillFrontmatterSchema, type SkillDocument } from "../schemas/skill.js";

export type CreateSkillOptions = {
  cwd?: string;
  name: string;
  description?: string;
  tags?: string[];
  maxTokens?: number;
  force?: boolean;
};

export async function createSkill(options: CreateSkillOptions): Promise<{ path: string; name: string }> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);

  const name = normalizeName(options.name);
  const filePath = skillFilePath(cwd, name);
  const data = skillFrontmatterSchema.parse({
    name,
    version: "0.1.0",
    description: options.description ?? "",
    max_tokens: options.maxTokens ?? 700,
    tags: options.tags ?? []
  });
  const body = [
    `# Skill: ${name}`,
    "",
    "## Purpose",
    "",
    options.description || "Describe when and how this skill should be used.",
    "",
    "## Check",
    "",
    "- Add concrete checks this skill should perform.",
    "",
    "## Reject if",
    "",
    "- Add conditions that should block the work.",
    "",
    "## Output",
    "",
    "1. Summary",
    "2. Findings or implementation notes",
    "3. Required fixes",
    "4. Verification performed"
  ].join("\n");

  await writeTextFile(filePath, stringifyMarkdownWithFrontmatter(data, body), {
    force: options.force
  });

  return { path: filePath, name };
}

export async function readSkill(cwd: string, name: string): Promise<SkillDocument> {
  await requireWorkspace(cwd);
  const normalized = normalizeName(name);
  const filePath = skillFilePath(cwd, normalized);

  try {
    const raw = await readTextFile(filePath);
    return parseMarkdownWithFrontmatter(raw, skillFrontmatterSchema, filePath);
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Skill not found: ${normalized}`);
    }

    throw error;
  }
}

export async function showSkill(cwd: string, name: string): Promise<string> {
  await requireWorkspace(cwd);
  const normalized = normalizeName(name);

  try {
    return await readTextFile(skillFilePath(cwd, normalized));
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Skill not found: ${normalized}`);
    }

    throw error;
  }
}

export async function listSkills(cwd = process.cwd()): Promise<SkillDocument[]> {
  await requireWorkspace(cwd);
  const files = await listFilesBySuffix(workspacePaths(cwd).skills, ".skill.md");

  return Promise.all(
    files.map(async (filePath) => {
      const raw = await readTextFile(filePath);
      return parseMarkdownWithFrontmatter(raw, skillFrontmatterSchema, filePath);
    })
  );
}
