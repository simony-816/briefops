import { promises as fs } from "node:fs";
import { BriefOpsError } from "./errors.js";
import { memoryCategories, workspacePaths } from "./paths.js";
import { ensureDirectory, pathExists, writeFileIfAbsent } from "./storage.js";

export type InitResult = {
  root: string;
  created: string[];
  existing: string[];
};

const defaultBriefTemplates: Record<string, string> = {
  "brief.generic.md": [
    "# BriefOps Task Brief",
    "",
    "{{warnings}}",
    "## Role",
    "",
    "You are operating as an AI coding agent prepared by BriefOps.",
    "",
    "{{workerSection}}",
    "## Primary Skill",
    "",
    "{{skillText}}",
    "",
    "## Project Context",
    "",
    "{{projectText}}",
    "",
    "## Relevant Memory",
    "",
    "{{memoryText}}",
    "",
    "## Task",
    "",
    "{{taskText}}",
    "",
    "## Delivery Format",
    "",
    "{{outputContract}}",
    "",
    "## Read If Needed",
    "",
    "{{readIfNeeded}}",
    "",
    "## Token Budget Report",
    "",
    "{{tokenReport}}",
    ""
  ].join("\n"),
  "brief.codex.md": [
    "# BriefOps Task Brief",
    "",
    "{{warnings}}",
    "## Role",
    "",
    "You are Codex operating with a BriefOps-prepared task brief. Follow the repository's existing patterns and verify your work before completion.",
    "",
    "{{workerSection}}",
    "## Primary Skill",
    "",
    "{{skillText}}",
    "",
    "## Project Context",
    "",
    "{{projectText}}",
    "",
    "## Relevant Memory",
    "",
    "{{memoryText}}",
    "",
    "## Task",
    "",
    "{{taskText}}",
    "",
    "## Delivery Format",
    "",
    "{{outputContract}}",
    "",
    "## Read If Needed",
    "",
    "{{readIfNeeded}}",
    "",
    "## Token Budget Report",
    "",
    "{{tokenReport}}",
    ""
  ].join("\n"),
  "brief.claude-code.md": [
    "# BriefOps Task Brief",
    "",
    "{{warnings}}",
    "## Role",
    "",
    "You are Claude Code operating with a BriefOps-prepared task brief. Keep changes scoped, explain verification, and preserve user work.",
    "",
    "{{workerSection}}",
    "## Primary Skill",
    "",
    "{{skillText}}",
    "",
    "## Project Context",
    "",
    "{{projectText}}",
    "",
    "## Relevant Memory",
    "",
    "{{memoryText}}",
    "",
    "## Task",
    "",
    "{{taskText}}",
    "",
    "## Delivery Format",
    "",
    "{{outputContract}}",
    "",
    "## Read If Needed",
    "",
    "{{readIfNeeded}}",
    "",
    "## Token Budget Report",
    "",
    "{{tokenReport}}",
    ""
  ].join("\n")
};

const defaultCodexPrompts: Record<string, string> = {
  "mission.md": [
    "# BriefOps Codex Mission",
    "",
    "Use this prompt when Codex should execute a task with a clear completion promise and evidence gates.",
    "",
    "Recommended command:",
    "",
    "```bash",
    "briefops codex mission --worker <worker> --task \"<task>\" --adapter codex --save",
    "```",
    ""
  ].join("\n"),
  "plan.md": [
    "# BriefOps Codex Plan",
    "",
    "Use this prompt when Codex should produce a decision-complete plan before editing product code.",
    "",
    "Recommended command:",
    "",
    "```bash",
    "briefops codex plan --project <project> --idea \"<what to build>\" --save",
    "```",
    ""
  ].join("\n")
};

export async function requireWorkspace(cwd = process.cwd()): Promise<void> {
  const paths = workspacePaths(cwd);
  if (!(await pathExists(paths.root))) {
    throw new BriefOpsError(".briefops workspace not found. Run `briefops init` first.");
  }
}

export async function initWorkspace(cwd = process.cwd()): Promise<InitResult> {
  const paths = workspacePaths(cwd);
  const created: string[] = [];
  const existing: string[] = [];

  for (const dirPath of [
    paths.root,
    paths.skills,
    paths.projects,
    paths.memory,
    paths.workers,
    paths.logs,
    paths.briefs,
    paths.codex,
    paths.codexPrompts,
    paths.evals,
    paths.evalResults,
    paths.patches,
    paths.templates
  ]) {
    if (await pathExists(dirPath)) {
      existing.push(dirPath);
    } else {
      await ensureDirectory(dirPath);
      created.push(dirPath);
    }
  }

  const configCreated = await writeFileIfAbsent(
    paths.config,
    [
      "version: 1.1.0",
      `created_at: "${new Date().toISOString()}"`,
      "memory_categories:",
      ...memoryCategories.map((category) => `  - ${category}`),
      ""
    ].join("\n")
  );
  (configCreated ? created : existing).push(paths.config);

  for (const category of memoryCategories) {
    const filePath = `${paths.memory}/${category}.yaml`;
    const fileCreated = await writeFileIfAbsent(filePath, "items: []\n");
    (fileCreated ? created : existing).push(filePath);
  }

  for (const [filename, template] of Object.entries(defaultBriefTemplates)) {
    const filePath = `${paths.templates}/${filename}`;
    const templateCreated = await writeFileIfAbsent(filePath, template);
    (templateCreated ? created : existing).push(filePath);
  }

  for (const [filename, template] of Object.entries(defaultCodexPrompts)) {
    const filePath = `${paths.codexPrompts}/${filename}`;
    const promptCreated = await writeFileIfAbsent(filePath, template);
    (promptCreated ? created : existing).push(filePath);
  }

  await fs.access(paths.root);
  return { root: paths.root, created, existing };
}
