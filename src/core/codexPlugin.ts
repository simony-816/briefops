import path from "node:path";
import { briefopsVersion } from "../version.js";
import { BriefOpsError } from "./errors.js";
import { workspacePaths } from "./paths.js";
import { pathExists, readTextFile, writeTextFile } from "./storage.js";
import { requireWorkspace } from "./workspace.js";

export type CodexPluginManifest = {
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    url: string;
  };
  homepage: string;
  repository: string;
  license: string;
  keywords: string[];
  skills: string;
  interface: {
    displayName: string;
    shortDescription: string;
    longDescription: string;
    developerName: string;
    category: string;
    capabilities: string[];
    defaultPrompt: string[];
    websiteURL: string;
    brandColor: string;
    screenshots: string[];
  };
};

export type CodexPluginFile = {
  relativePath: string;
  content: string;
};

export type CodexPluginFileStatus = "ok" | "missing" | "changed";

export type CodexPluginInspection = {
  root: string;
  ok: boolean;
  files: Array<{
    relativePath: string;
    status: CodexPluginFileStatus;
  }>;
};

export function buildCodexPluginManifest(): CodexPluginManifest {
  return {
    name: "briefops",
    version: briefopsVersion,
    description: "Local-first, token-aware persistent work history for Codex workflows.",
    author: {
      name: "BriefOps contributors",
      url: "https://github.com/simony-816/briefops"
    },
    homepage: "https://github.com/simony-816/briefops",
    repository: "https://github.com/simony-816/briefops",
    license: "MIT",
    keywords: ["codex", "local-first", "context", "memory", "handoff", "workflow"],
    skills: "./skills/",
    interface: {
      displayName: "BriefOps",
      shortDescription: "local-first context priming and continuity for Codex",
      longDescription:
        "Use BriefOps to prime Codex with compact local context, record task outcomes, review durable memory proposals, and resume persistent workers without hosted services.",
      developerName: "BriefOps contributors",
      category: "Developer Tools",
      capabilities: ["Read", "Write"],
      defaultPrompt: [
        "Start this task with the smallest useful BriefOps context.",
        "Finish this task and prepare memory for the next thread."
      ],
      websiteURL: "https://github.com/simony-816/briefops",
      brandColor: "#2563EB",
      screenshots: []
    }
  };
}

function pluginManifestContent(): string {
  return `${JSON.stringify(buildCodexPluginManifest(), null, 2)}\n`;
}

function trustBoundaryLines(): string[] {
  return [
    "The BriefOps plugin is a local CLI helper. It does not require network access and does not publish to a marketplace.",
    "",
    "BriefOps may update directory-local `.briefops/` memory. Use `--export-policy shared-only` before copying context outside the local workspace, and ask before applying skill patches.",
    ""
  ];
}

function briefopsPrimeContextSkill(): string {
  return [
    "---",
    "name: briefops-prime-context",
    "description: Use when starting work in any Codex project or fresh thread to load the smallest useful BriefOps context before reading large history files",
    "---",
    "",
    "# BriefOps Prime Context",
    "",
    ...trustBoundaryLines(),
    "Use BriefOps before broad repo/history inspection when a `.briefops` workspace exists or may exist.",
    "",
    "Run:",
    "",
    "```bash",
    "briefops prime --format codex --task \"<current user task>\" --max-tokens 800",
    "```",
    "",
    "If the command reports `setup-required`, keep the response short and suggest `briefops bootstrap` for first adoption.",
    "",
    "BriefOps memory is directory-local. `briefops finish` auto-promotes durable memory by default; pending proposals from older or review-mode flows can be applied locally without blocking the task.",
    "",
    "Treat the prime output as a compact routing brief, not as permission to skip relevant code inspection.",
    ""
  ].join("\n");
}

function briefopsFinishTaskSkill(): string {
  return [
    "---",
    "name: briefops-finish-task",
    "description: Use when finishing a Codex task to record the outcome, update directory-local durable memory, and prepare the next thread",
    "---",
    "",
    "# BriefOps Finish Task",
    "",
    ...trustBoundaryLines(),
    "Use BriefOps at the end of meaningful work so future Codex threads do not spend tokens rediscovering the same decisions, risks, and lessons.",
    "",
    "Run a scoped finish command with the actual result and any durable candidates:",
    "",
    "```bash",
    "briefops finish --worker <worker> --task \"<task>\" --result \"<result>\" --lesson \"<lesson>\" --next-step \"<next step>\"",
    "```",
    "",
    "Only include lessons, decisions, incidents, open risks, and next steps that will help future work. Do not store secrets or personal data.",
    "",
    "`briefops finish` applies durable memory locally by default and keeps the proposal file as an audit trail. Use `--memory-review` only when the user explicitly wants a pending review queue.",
    ""
  ].join("\n");
}

function briefopsReviewMemorySkill(): string {
  return [
    "---",
    "name: briefops-review-memory",
    "description: Use when BriefOps reports pending local memory proposals or skill patches that need inspection",
    "---",
    "",
    "# BriefOps Review Memory",
    "",
    ...trustBoundaryLines(),
    "BriefOps memory is directory-local. Pending memory proposals are optional audit/review drafts; they should not block normal continuation.",
    "",
    "Inspect proposals before applying:",
    "",
    "```bash",
    "briefops memory proposal-show latest",
    "briefops inbox",
    "```",
    "",
    "Apply relevant local memory proposals directly, or reject inaccurate, duplicate, sensitive, or overly broad proposals:",
    "",
    "```bash",
    "briefops memory proposal-apply latest",
    "briefops memory proposal-reject latest",
    "```",
    "",
    "Ask before applying skill patches or exporting private memory outside the local workspace.",
    ""
  ].join("\n");
}

function briefopsContinueWorkerSkill(): string {
  return [
    "---",
    "name: briefops-continue-worker",
    "description: Use when continuing a persistent BriefOps worker in a fresh Codex thread with a handoff, resume prompt, or portable pack",
    "---",
    "",
    "# BriefOps Continue Worker",
    "",
    ...trustBoundaryLines(),
    "Use this workflow when the user wants a fresh Codex thread to continue prior work with the same worker identity, project constraints, memory, and risks.",
    "",
    "Prepare a resume prompt and optional portable pack:",
    "",
    "```bash",
    "briefops continue --worker <worker> --task \"<next task>\" --pack",
    "```",
    "",
    "Pending memory proposals are optional local review drafts and do not block continuing. Apply relevant local memory when useful; ask before applying skill patches.",
    "",
    "Use portable packs only as explicit local user artifacts. They may include private local memory and should be reviewed before sharing.",
    ""
  ].join("\n");
}

export function codexPluginFiles(): CodexPluginFile[] {
  return [
    {
      relativePath: ".codex-plugin/plugin.json",
      content: pluginManifestContent()
    },
    {
      relativePath: "skills/briefops-prime-context/SKILL.md",
      content: briefopsPrimeContextSkill()
    },
    {
      relativePath: "skills/briefops-finish-task/SKILL.md",
      content: briefopsFinishTaskSkill()
    },
    {
      relativePath: "skills/briefops-review-memory/SKILL.md",
      content: briefopsReviewMemorySkill()
    },
    {
      relativePath: "skills/briefops-continue-worker/SKILL.md",
      content: briefopsContinueWorkerSkill()
    }
  ];
}

async function writeGeneratedPluginFile(options: {
  target: string;
  content: string;
  force: boolean;
}): Promise<void> {
  if (await pathExists(options.target)) {
    const existing = await readTextFile(options.target);
    if (existing === options.content) {
      return;
    }
    if (!options.force) {
      throw new BriefOpsError(
        `Generated plugin file has local changes: ${options.target}. Re-run with --force to overwrite.`
      );
    }
  }

  await writeTextFile(options.target, options.content, { force: true });
}

export async function installCodexPlugin(options: {
  cwd?: string;
  force?: boolean;
} = {}): Promise<{
  root: string;
  files: string[];
}> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const root = path.join(workspacePaths(cwd).codex, "plugin", "briefops");
  const files: string[] = [];

  for (const file of codexPluginFiles()) {
    const target = path.join(root, file.relativePath);
    await writeGeneratedPluginFile({
      target,
      content: file.content,
      force: Boolean(options.force)
    });
    files.push(file.relativePath);
  }

  return { root, files };
}

export async function inspectCodexPlugin(options: {
  cwd?: string;
} = {}): Promise<CodexPluginInspection> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const root = path.join(workspacePaths(cwd).codex, "plugin", "briefops");
  const files = await Promise.all(
    codexPluginFiles().map(async (file) => {
      const target = path.join(root, file.relativePath);
      if (!(await pathExists(target))) {
        return {
          relativePath: file.relativePath,
          status: "missing" as const
        };
      }

      const status: CodexPluginFileStatus =
        (await readTextFile(target)) === file.content ? "ok" : "changed";
      return {
        relativePath: file.relativePath,
        status
      };
    })
  );

  return {
    root,
    ok: files.every((file) => file.status === "ok"),
    files
  };
}
