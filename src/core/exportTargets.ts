import path from "node:path";
import { defaultContextBudgets, formatBudgetLine } from "./contextBudget.js";
import { BriefOpsError } from "./errors.js";
import {
  normalizeExportPolicy,
  sharedOnlyOmissionNote,
  type ExportPolicy
} from "./exportPolicy.js";
import { estimateTokens } from "./tokens.js";

export type ExportTarget =
  | "agents-md"
  | "claude-md"
  | "cursor-rules";

export type ExportMode = "router";

export type HarnessExportOptions = {
  cwd?: string;
  target: ExportTarget;
  worker?: string;
  project?: string;
  exportPolicy?: ExportPolicy;
  outputPath?: string;
  force?: boolean;
  dryRun?: boolean;
  stdout?: boolean;
};

export type HarnessExportFile = {
  path: string;
  content: string;
  tokens: number;
  written: boolean;
};

export type HarnessExportResult = {
  files: HarnessExportFile[];
  warnings: string[];
};

type RenderOptions = {
  worker?: string;
  project?: string;
  exportPolicy: ExportPolicy;
};

function shellValue(value: string): string {
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function workerFlag(worker?: string): string {
  return worker ? ` --worker ${worker}` : " --worker <worker>";
}

function projectLine(project?: string): string[] {
  return project ? ["", `Project: \`${project}\``] : [];
}

function policyLines(exportPolicy: ExportPolicy): string[] {
  return [
    "",
    `Export policy: \`${exportPolicy}\``,
    exportPolicy === "shared-only"
      ? "These instructions are safe to commit because they route agents to BriefOps instead of copying private local memory."
      : "Local-private export was selected; keep this file local unless you review it before sharing."
  ];
}

function renderAgentsMd(options: RenderOptions): string {
  const worker = options.worker ?? "<worker>";
  return [
    "# BriefOps Agent Instructions",
    "",
    "This repository uses BriefOps for local AI coding continuity.",
    ...projectLine(options.project),
    ...policyLines(options.exportPolicy),
    "",
    "## Start Of Work",
    "",
    "Before broad repo/history inspection, run:",
    "",
    "```bash",
    `briefops prime --format codex --task ${shellValue("<current task>")} --max-tokens 800`,
    "```",
    "",
    "Use the output as a routing brief, not as a replacement for relevant code inspection.",
    "",
    "## Finish Of Work",
    "",
    "At the end of meaningful work, run:",
    "",
    "```bash",
    `briefops finish --worker ${worker} --task ${shellValue("<completed task>")} --result ${shellValue("<result>")}`,
    "```",
    "",
    "Add `--lesson`, `--decision`, `--open-risk`, or `--next-step` only when the item is durable and useful for future work.",
    "",
    "## Memory Approval",
    "",
    "Never apply memory automatically.",
    "",
    "Ask the user before running:",
    "",
    "```bash",
    "briefops approve latest",
    "```",
    "",
    "## Fresh Thread Resume",
    "",
    "When continuing in a fresh thread:",
    "",
    "```bash",
    `briefops continue --worker ${worker} --task ${shellValue("<next task>")} --pack`,
    "```",
    "",
    "## Boundaries",
    "",
    "- Do not dump the entire `.briefops/` directory.",
    "- Do not auto-approve memory or skill patches.",
    "- Do not treat BriefOps context as a substitute for code inspection.",
    "- Prefer compact prime context before reading large history.",
    ""
  ].join("\n");
}

function renderClaudeMd(options: RenderOptions): string {
  const worker = options.worker ?? "<worker>";
  return [
    "# Claude Code Instructions: BriefOps",
    "",
    "This project uses BriefOps for local work continuity.",
    ...projectLine(options.project),
    ...policyLines(options.exportPolicy),
    "",
    "## Before Starting Work",
    "",
    "Run:",
    "",
    "```bash",
    `briefops prime --format markdown --task ${shellValue("<current task>")} --max-tokens 800`,
    "```",
    "",
    "Use the result to understand the selected worker, relevant project context, approved memory, open risks, and pending review items.",
    "",
    "## During Work",
    "",
    "Inspect only files relevant to the current task.",
    "",
    "Do not read the entire `.briefops/` workspace unless explicitly asked.",
    "",
    "## After Meaningful Work",
    "",
    "Run:",
    "",
    "```bash",
    `briefops finish --worker ${worker} --task ${shellValue("<task>")} --result ${shellValue("<result>")}`,
    "```",
    "",
    "Use durable fields only when useful:",
    "",
    "```bash",
    "--lesson",
    "--decision",
    "--open-risk",
    "--next-step",
    "```",
    "",
    "## Human Approval Required",
    "",
    "Never apply BriefOps memory or skill patches automatically.",
    "",
    "Ask before:",
    "",
    "```bash",
    "briefops approve latest",
    "```",
    "",
    "## Fresh Thread Resume",
    "",
    "For a fresh Claude/Codex thread:",
    "",
    "```bash",
    `briefops continue --worker ${worker} --task ${shellValue("<next task>")} --pack`,
    "```",
    ""
  ].join("\n");
}

function cursorRule(description: string, alwaysApply: boolean, body: string): string {
  return [
    "---",
    `description: ${description}`,
    `alwaysApply: ${alwaysApply ? "true" : "false"}`,
    "---",
    "",
    body.trim(),
    ""
  ].join("\n");
}

function renderCursorRules(options: RenderOptions): Array<{ relativePath: string; content: string }> {
  const worker = options.worker ?? "<worker>";
  const policyNote = options.exportPolicy === "shared-only" ? `\n\n${sharedOnlyOmissionNote}` : "";
  return [
    {
      relativePath: ".cursor/rules/briefops-prime.mdc",
      content: cursorRule(
        "Use BriefOps to prime AI coding context before broad repo/history inspection.",
        true,
        [
          "# BriefOps Prime",
          "",
          "This repository uses BriefOps for local AI coding continuity.",
          policyNote.trim() ? policyNote.trimStart() : undefined,
          "",
          "Before broad repo/history inspection, run:",
          "",
          "```bash",
          `briefops prime --format codex --task ${shellValue("<current task>")} --max-tokens 800`,
          "```",
          "",
          "Use the result as a compact routing brief.",
          "",
          "Do not:",
          "- dump the full `.briefops` workspace",
          "- auto-approve memory or skill patches",
          "- treat prime context as a replacement for relevant code inspection"
        ].filter((line): line is string => line !== undefined).join("\n")
      )
    },
    {
      relativePath: ".cursor/rules/briefops-finish.mdc",
      content: cursorRule(
        "Use when finishing meaningful AI coding work and recording durable lessons, decisions, risks, or next steps.",
        false,
        [
          "# BriefOps Finish",
          "",
          "At the end of meaningful work, run `briefops finish`.",
          "",
          `Default worker hint: \`${worker}\`.`,
          "",
          "Only record durable items that will help future work.",
          "",
          "Do not create memory that the user did not approve."
        ].join("\n")
      )
    },
    {
      relativePath: ".cursor/rules/briefops-memory-review.mdc",
      content: cursorRule(
        "Use when BriefOps reports pending memory proposals or skill patches that need human review.",
        false,
        [
          "# BriefOps Memory Review",
          "",
          "Memory and skill patch changes are human-approved.",
          "",
          "Review first:",
          "",
          "```bash",
          "briefops memory proposal-show latest",
          "briefops inbox",
          "```",
          "",
          "Apply only after explicit user confirmation:",
          "",
          "```bash",
          "briefops approve latest",
          "```"
        ].join("\n")
      )
    },
    {
      relativePath: ".cursor/rules/briefops-continue.mdc",
      content: cursorRule(
        "Use when continuing a BriefOps worker in a fresh thread.",
        false,
        [
          "# BriefOps Continue",
          "",
          "When continuing prior work in a fresh thread, run:",
          "",
          "```bash",
          `briefops continue --worker ${worker} --task ${shellValue("<next task>")} --pack`,
          "```",
          "",
          "Use the generated pack as the continuity handoff.",
          "",
          "Do not treat it as permission to skip relevant code inspection."
        ].join("\n")
      )
    }
  ];
}

function defaultRelativePath(target: ExportTarget): string {
  if (target === "agents-md") {
    return "AGENTS.md";
  }
  if (target === "claude-md") {
    return "CLAUDE.md";
  }
  throw new BriefOpsError("--output is not supported for cursor-rules because it writes multiple files.");
}

function hardWarningBudget(target: ExportTarget, tokens: number): number {
  if (target === "agents-md") {
    return 800;
  }
  if (target === "claude-md") {
    return 1000;
  }
  return defaultContextBudgets.exportCursorTotal;
}

export function renderHarnessExport(options: HarnessExportOptions): HarnessExportResult {
  const cwd = options.cwd ?? process.cwd();
  const exportPolicy = normalizeExportPolicy(options.exportPolicy ?? "shared-only");
  const renderOptions = {
    worker: options.worker,
    project: options.project,
    exportPolicy
  };
  const rendered = options.target === "agents-md"
    ? [{ relativePath: options.outputPath ?? defaultRelativePath(options.target), content: renderAgentsMd(renderOptions) }]
    : options.target === "claude-md"
      ? [{ relativePath: options.outputPath ?? defaultRelativePath(options.target), content: renderClaudeMd(renderOptions) }]
      : renderCursorRules(renderOptions);
  const files = rendered.map((file) => {
    const resolvedPath = path.isAbsolute(file.relativePath)
      ? file.relativePath
      : path.join(cwd, file.relativePath);
    return {
      path: resolvedPath,
      content: file.content,
      tokens: estimateTokens(file.content),
      written: false
    };
  });
  const warnings: string[] = [];
  for (const file of files) {
    const perFileBudget = options.target === "agents-md"
      ? defaultContextBudgets.exportAgentsMd
      : options.target === "claude-md"
        ? defaultContextBudgets.exportClaudeMd
        : defaultContextBudgets.exportCursorRule;
    if (file.tokens > perFileBudget) {
      warnings.push(formatBudgetLine(path.basename(file.path), file.tokens, perFileBudget));
    }
  }
  const total = files.reduce((sum, file) => sum + file.tokens, 0);
  const hardBudget = hardWarningBudget(options.target, total);
  if (total > hardBudget) {
    warnings.push(formatBudgetLine("export total", total, hardBudget));
  }

  return { files, warnings };
}
