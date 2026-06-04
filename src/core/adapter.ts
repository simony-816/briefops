import path from "node:path";
import { BriefOpsError } from "./errors.js";
import { workspacePaths } from "./paths.js";
import { pathExists, readTextFile } from "./storage.js";
import type { TokenReportLine } from "../schemas/brief.js";

export const briefAdapters = ["generic", "codex", "claude-code"] as const;
export type BriefAdapter = (typeof briefAdapters)[number];

export type BriefTemplateParts = {
  warnings: string[];
  workerText: string;
  skillText: string;
  projectText: string;
  memoryText: string;
  taskText: string;
  outputContract: string;
  readIfNeeded: string;
  report: TokenReportLine[];
  totalTokens: number;
  budget: number;
};

const fallbackTemplates: Record<BriefAdapter, string> = {
  generic: [
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
  codex: [
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
  "claude-code": [
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

export function normalizeBriefAdapter(value?: string): BriefAdapter {
  const adapter = (value ?? "generic").trim().toLowerCase();
  if ((briefAdapters as readonly string[]).includes(adapter)) {
    return adapter as BriefAdapter;
  }

  throw new BriefOpsError(`Invalid brief adapter: ${value}`);
}

function formatTokenReport(report: TokenReportLine[], total: number, budget: number): string {
  return [
    ...report.map((line) => `- ${line.label}: ${line.used} / ${line.budget}`),
    `- Total: ${total} / ${budget}`
  ].join("\n");
}

async function readTemplate(cwd: string, adapter: BriefAdapter): Promise<string> {
  const templatePath = path.join(workspacePaths(cwd).templates, `brief.${adapter}.md`);
  if (await pathExists(templatePath)) {
    return readTextFile(templatePath);
  }

  return fallbackTemplates[adapter];
}

export async function renderBriefWithAdapter(options: {
  cwd: string;
  adapter: BriefAdapter;
  parts: BriefTemplateParts;
}): Promise<string> {
  const template = await readTemplate(options.cwd, options.adapter);
  const workerSection = options.parts.workerText
    ? `## Worker Profile\n\n${options.parts.workerText}\n`
    : "";
  const warnings =
    options.parts.warnings.length > 0
      ? `${options.parts.warnings.map((warning) => `> Warning: ${warning}`).join("\n")}\n`
      : "";
  const replacements: Record<string, string> = {
    warnings,
    workerSection,
    skillText: options.parts.skillText,
    projectText: options.parts.projectText,
    memoryText: options.parts.memoryText,
    taskText: options.parts.taskText,
    outputContract: options.parts.outputContract,
    readIfNeeded: options.parts.readIfNeeded,
    tokenReport: formatTokenReport(
      options.parts.report,
      options.parts.totalTokens,
      options.parts.budget
    )
  };

  let rendered = template;
  for (const [name, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(`{{${name}}}`, value);
  }

  return `${rendered.replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
