import { readBriefOpsConfig } from "./config.js";
import { inspectContinuityHealth } from "./continuity.js";
import {
  filterMemoryForExport,
  normalizeExportPolicy,
  sharedOnlyOmissionNote,
  type ExportPolicy
} from "./exportPolicy.js";
import { getInboxSummary } from "./inbox.js";
import { listWorkLogs } from "./log.js";
import { formatMemoryItem, selectContinuityContext } from "./memory.js";
import { normalizeName, workspacePaths } from "./paths.js";
import { estimateTokens, truncateToTokenBudget } from "./tokens.js";
import { listWorkers, readWorker } from "./worker.js";
import { pathExists } from "./storage.js";

export type PrimeContextOptions = {
  cwd?: string;
  worker?: string;
  project?: string;
  task?: string;
  maxTokens?: number;
  format?: "markdown" | "codex";
  exportPolicy?: ExportPolicy;
};

export type PrimeContextResult = {
  status: "ready" | "attention-required" | "setup-required";
  content: string;
  tokens: number;
  warnings: string[];
};

function quote(value: string): string {
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function renderList(values: string[], empty: string, limit: number): string {
  const items = unique(values).slice(0, limit);
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : empty;
}

function setupRequiredContent(maxTokens: number): PrimeContextResult {
  const content = truncateToTokenBudget(
    [
      "# BriefOps Prime Context",
      "",
      "Status: setup-required",
      "",
      "No `.briefops` workspace was found here.",
      "",
      "Run the adoption bootstrap:",
      "",
      "```bash",
      "briefops bootstrap",
      "```",
      "",
      "Manual setup path:",
      "",
      "```bash",
      "briefops init",
      "briefops codex install",
      "briefops codex plugin install",
      "briefops skill create <skill>",
      "briefops project create <project>",
      "briefops worker create <worker> --project <project> --skills \"<skill>\"",
      "briefops worker use <worker>",
      "```",
      ""
    ].join("\n"),
    maxTokens
  ).text;

  return {
    status: "setup-required",
    content,
    tokens: estimateTokens(content),
    warnings: ["BriefOps workspace not found."]
  };
}

function attentionRequiredContent(options: {
  task: string;
  maxTokens: number;
  workers: string[];
  reason: string;
}): PrimeContextResult {
  const workerList =
    options.workers.length > 0
      ? options.workers.map((worker) => `- ${worker}`).join("\n")
      : "- No active workers found.";
  const content = truncateToTokenBudget(
    [
      "# BriefOps Prime Context",
      "",
      "Status: attention-required",
      "",
      "## Current Task",
      "",
      options.task,
      "",
      "## Reason",
      "",
      options.reason,
      "",
      "## Available Workers",
      "",
      workerList,
      "",
      "## Recommended Commands",
      "",
      "```bash",
      "briefops worker list",
      "briefops worker use <worker>",
      "```",
      "",
      "## Token Budget",
      "",
      `- Maximum: ${options.maxTokens}`,
      ""
    ].join("\n"),
    options.maxTokens
  ).text;

  return {
    status: "attention-required",
    content,
    tokens: estimateTokens(content),
    warnings: [options.reason]
  };
}

async function resolvePrimeWorker(options: {
  cwd: string;
  worker?: string;
}): Promise<{ worker?: string; attention?: PrimeContextResult }> {
  if (options.worker) {
    return { worker: normalizeName(options.worker) };
  }

  const config = await readBriefOpsConfig(options.cwd);
  if (config.defaults.worker) {
    return { worker: config.defaults.worker };
  }

  const workers = await listWorkers({
    cwd: options.cwd,
    status: "active"
  });
  if (workers.length === 1) {
    return { worker: workers[0].name };
  }

  return {
    attention: attentionRequiredContent({
      task: "No current task provided.",
      maxTokens: 800,
      workers: workers.map((worker) => worker.name),
      reason: "Select a default worker before priming context."
    })
  };
}

export async function primeContext(options: PrimeContextOptions = {}): Promise<PrimeContextResult> {
  const cwd = options.cwd ?? process.cwd();
  const maxTokens = options.maxTokens ?? 800;
  const task = options.task?.trim() || "No current task provided.";
  const format = options.format ?? "markdown";
  const exportPolicy = normalizeExportPolicy(options.exportPolicy);

  if (!(await pathExists(workspacePaths(cwd).root))) {
    return setupRequiredContent(maxTokens);
  }

  const resolved = await resolvePrimeWorker({
    cwd,
    worker: options.worker
  });
  if (resolved.attention) {
    return attentionRequiredContent({
      task,
      maxTokens,
      workers: (await listWorkers({ cwd, status: "active" })).map((worker) => worker.name),
      reason: "Select a default worker before priming context."
    });
  }

  const workerName = resolved.worker as string;
  const worker = await readWorker(cwd, workerName);
  const project = options.project ? normalizeName(options.project) : worker.project;
  if (!project) {
    return attentionRequiredContent({
      task,
      maxTokens,
      workers: [workerName],
      reason: `Worker ${workerName} has no default project. Recreate it with --project or pass --project.`
    });
  }

  const health = await inspectContinuityHealth({
    cwd,
    project,
    worker: workerName
  });
  const inbox = await getInboxSummary({
    cwd,
    project,
    worker: workerName
  });
  const memory = await selectContinuityContext({
    cwd,
    project,
    skills: worker.default_skills,
    worker: workerName,
    task,
    maxTokens: Math.max(120, Math.floor(maxTokens * 0.28)),
    quotas: {
      facts: 2,
      decisions: 3,
      lessons: 3,
      incidents: 2,
      deprecated: 0
    }
  });
  const memoryItems = filterMemoryForExport(memory.items, exportPolicy);
  const memoryText =
    memoryItems.length > 0
      ? memoryItems.map(formatMemoryItem).join("\n")
      : "No active matching memory selected.";
  const logs = await listWorkLogs({
    cwd,
    project,
    worker: workerName,
    limit: 8
  });
  const openRisks = exportPolicy === "shared-only" ? [] : logs.flatMap((log) => log.open_risks);
  const nextSteps = exportPolicy === "shared-only" ? [] : logs.flatMap((log) => log.next_steps);
  const pendingReview: string[] = exportPolicy === "shared-only"
    ? [
        sharedOnlyOmissionNote,
        "Local memory queue counts are omitted by shared-only policy.",
        format === "codex"
          ? "Codex format is active; follow the operating note below before broad repo/history inspection."
          : undefined
      ].filter((item): item is string => Boolean(item))
    : [
        inbox.pendingMemoryProposals > 0
          ? `${inbox.pendingMemoryProposals} pending local memory proposal(s).`
          : undefined,
        inbox.pendingSkillPatches > 0 ? `${inbox.pendingSkillPatches} pending skill patch(es).` : undefined,
        "This context may include private local BriefOps memory. Review before sharing outside this machine.",
        format === "codex"
          ? "Codex format is active; follow the operating note below before broad repo/history inspection."
          : undefined
      ].filter((item): item is string => Boolean(item));
  const warnings = [
    health.readiness === "WARN" ? "Continuity health is WARN." : undefined,
    inbox.pendingMemoryProposals > 0 ? "Pending local memory proposals exist but do not block continuing." : undefined,
    exportPolicy === "local-private" ? "Prime context may include private local memory." : undefined
  ].filter((warning): warning is string => Boolean(warning));
  const codexOperatingNote = format === "codex"
    ? [
        "## Codex Operating Note",
        "",
        "Use this as a routing brief before broad repo/history inspection.",
        "",
        "Do:",
        "- Restate the current task.",
        "- Use the selected worker/project context.",
        "- Inspect only the files needed for the task.",
        "- Treat `.briefops/` memory as local repo state; `briefops finish` auto-promotes durable local memory by default.",
        "- Ask before exporting private memory outside this machine or applying skill patches.",
        `- Use \`briefops continue --worker ${workerName} --task ${quote(task)} --pack\` when a fresh-thread resume is needed.`,
        "",
        "Do not:",
        "- Dump the entire `.briefops` workspace.",
        "- Share local-private memory or apply skill patches without explicit user direction.",
        "- Treat this prime context as a substitute for relevant code inspection.",
        ""
      ]
    : [];
  const content = [
    "# BriefOps Prime Context",
    "",
    `Status: ready`,
    "",
    "## Token Budget",
    "",
    `- Maximum: ${maxTokens}`,
    `- Export policy: ${exportPolicy}`,
    "",
    "## Current Task",
    "",
    task,
    "",
    "## Worker",
    "",
    `- Worker: ${workerName}`,
    `- Project: ${project}`,
    `- Skills: ${worker.default_skills.length > 0 ? worker.default_skills.join(", ") : "none"}`,
    "",
    ...codexOperatingNote,
    "## Continuity Status",
    "",
    `- Readiness: ${health.readiness}`,
    exportPolicy === "shared-only"
      ? "- Work logs: omitted by shared-only policy"
      : `- Work logs: ${health.history.workLogs}`,
    exportPolicy === "shared-only"
      ? "- Active memory: shared/exportable selected only"
      : `- Active memory: ${Object.entries(health.memory).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    exportPolicy === "shared-only"
      ? `- Shared/exportable memory selected: ${memoryItems.length}`
      : undefined,
    "",
    "## Highest-Value Memory",
    "",
    memoryText,
    "",
    "## Open Risks And Next Steps",
    "",
    "Open risks:",
    exportPolicy === "shared-only"
      ? `- ${sharedOnlyOmissionNote}`
      : renderList(openRisks, "- No open risks found.", 4),
    "",
    "Next steps:",
    exportPolicy === "shared-only"
      ? `- ${sharedOnlyOmissionNote}`
      : renderList(nextSteps, "- No next steps found.", 4),
    "",
    "## Local Memory Queue",
    "",
    pendingReview.length > 0
      ? pendingReview.map((item) => `- ${item}`).join("\n")
      : "- No pending local memory or skill queue found.",
    "",
    "## Recommended Commands",
    "",
    "```bash",
    `briefops prime --format ${format} --task ${quote(task)} --max-tokens ${maxTokens}`,
    inbox.pendingMemoryProposals > 0 ? "briefops memory proposal-apply latest" : undefined,
    `briefops continue --worker ${workerName} --task ${quote(task)} --pack`,
    "```",
    ""
  ].filter((line): line is string => line !== undefined).join("\n");
  const trimmed = truncateToTokenBudget(content, maxTokens).text;

  return {
    status: "ready",
    content: trimmed,
    tokens: estimateTokens(trimmed),
    warnings
  };
}
