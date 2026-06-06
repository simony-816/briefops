import path from "node:path";
import { BriefOpsError } from "./errors.js";
import { readWorkLog } from "./log.js";
import { addMemoryIfMissing } from "./memory.js";
import { formatDateStamp, normalizeName, slugForFilename, workspacePaths } from "./paths.js";
import { listFilesBySuffix, readTextFile, writeYamlFile } from "./storage.js";
import { requireWorkspace } from "./workspace.js";
import {
  memoryProposalSchema,
  type MemoryProposal,
  type MemoryProposalEntry,
  type MemoryProposalStatus
} from "../schemas/memoryProposal.js";
import YAML from "yaml";

export type ProposeMemoryFromLogOptions = {
  cwd?: string;
  fromLog: string;
};

export type ListMemoryProposalFilters = {
  cwd?: string;
  status?: MemoryProposalStatus | string;
  project?: string;
  skill?: string;
};

export const NO_MEMORY_PROPOSAL_CANDIDATES_PREFIX = "No memory proposal candidates found in log:";

export function isNoMemoryProposalCandidatesError(error: unknown): boolean {
  return error instanceof BriefOpsError &&
    error.message.startsWith(NO_MEMORY_PROPOSAL_CANDIDATES_PREFIX);
}

function proposalId(date = new Date()): string {
  return `memprop_${formatDateStamp(date)}`;
}

const tagKeywords = [
  "turnover",
  "slippage",
  "risk",
  "rebalance",
  "policy",
  "test",
  "release",
  "billing",
  "localization",
  "security",
  "performance",
  "migration"
] as const;

function tagsFromText(value: string): string[] {
  const lower = value.toLowerCase();
  const tags = tagKeywords.filter((tag) => lower.includes(tag));
  return [...new Set(tags)];
}

function extractPrefixedNotes(notes: string, prefix: "decision" | "fact"): MemoryProposalEntry[] {
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith(`${prefix}:`))
    .map((line) => line.slice(prefix.length + 1).trim())
    .filter(Boolean)
    .map((content) => ({
      category: prefix === "decision" ? "decisions" as const : "facts" as const,
      type: prefix,
      status: "active" as const,
      content,
      tags: tagsFromText(content),
      visibility: "private" as const,
      exportable: false,
      rationale: `Extracted from work log note prefix: ${prefix}.`
    }));
}

function isIncidentCandidate(result: string): boolean {
  return /\b(missing|missed|failed|blocked|unverified|risk|violation|regression|incident|error|bug|failure)\b/i.test(result);
}

function isNormativeNextStep(value: string): boolean {
  return /\b(must|always|never|require|requires|required|policy|verify|check)\b/i.test(value);
}

function entry(options: {
  type: MemoryProposalEntry["type"];
  content: string;
  source: string;
  rationale: string;
}): MemoryProposalEntry {
  const category = ({
    fact: "facts",
    decision: "decisions",
    lesson: "lessons",
    incident: "incidents",
    deprecated: "deprecated"
  } as const)[options.type];
  return {
    category,
    type: options.type,
    status: "active",
    content: options.content.trim(),
    source: options.source,
    tags: tagsFromText(options.content),
    visibility: "private",
    exportable: false,
    rationale: options.rationale
  };
}

async function writeProposal(cwd: string, proposal: MemoryProposal): Promise<string> {
  const filePath = path.join(
    workspacePaths(cwd).memoryProposals,
    `${proposal.id}-${slugForFilename(proposal.project ?? "global")}-${slugForFilename(
      proposal.worker ?? proposal.skill ?? "memory"
    )}.memory-proposal.yaml`
  );
  await writeYamlFile(filePath, proposal);
  return filePath;
}

export async function proposeMemoryFromLog(
  options: ProposeMemoryFromLogOptions
): Promise<{ path: string; proposal: MemoryProposal }> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const log = await readWorkLog(cwd, options.fromLog);
  const createdAt = new Date().toISOString();
  const proposals: MemoryProposalEntry[] = [
    ...log.lessons.map((lesson) =>
      entry({
        type: "lesson",
        content: lesson,
        source: log.id,
        rationale: "Extracted from work log lesson."
      })
    ),
    ...log.open_risks.map((risk) =>
      entry({
        type: "incident",
        content: risk,
        source: log.id,
        rationale: "Extracted from work log open risk."
      })
    ),
    ...log.decisions.map((decision) =>
      entry({
        type: "decision",
        content: decision,
        source: log.id,
        rationale: "Extracted from work log decision."
      })
    ),
    ...log.incidents.map((incident) =>
      entry({
        type: "incident",
        content: incident,
        source: log.id,
        rationale: "Extracted from work log incident."
      })
    ),
    ...log.next_steps
      .filter(isNormativeNextStep)
      .map((step) =>
        entry({
          type: "decision",
          content: step,
          source: log.id,
          rationale: "Extracted from normative work log next step."
        })
      ),
    ...extractPrefixedNotes(log.notes, "decision"),
    ...extractPrefixedNotes(log.notes, "fact")
  ];

  if (isIncidentCandidate(log.result)) {
    proposals.push(entry({
      type: "incident",
      content: log.result,
      source: log.id,
      rationale: "Extracted from work log result because it contains failure/risk language."
    }));
  }

  if (proposals.length === 0) {
    throw new BriefOpsError(`${NO_MEMORY_PROPOSAL_CANDIDATES_PREFIX} ${log.id}`);
  }

  const proposal = memoryProposalSchema.parse({
    id: proposalId(new Date(createdAt)),
    created_at: createdAt,
    from_log: log.id,
    status: "proposed",
    project: log.project,
    skill: log.skill,
    worker: log.worker,
    items: proposals
  });
  return {
    path: await writeProposal(cwd, proposal),
    proposal
  };
}

export async function readMemoryProposal(cwd: string, id: string): Promise<MemoryProposal> {
  await requireWorkspace(cwd);
  const normalized = id.trim().toLowerCase();
  try {
    const files = await listFilesBySuffix(workspacePaths(cwd).memoryProposals, ".memory-proposal.yaml");
    const filePath =
      normalized === "latest"
        ? [...files].sort().at(-1)
        : files.find((file) => path.basename(file).startsWith(normalizeName(id)));
    if (!filePath) {
      throw new BriefOpsError(`Memory proposal not found: ${id}`);
    }
    const parsed = YAML.parse(await readTextFile(filePath));
    const result = memoryProposalSchema.safeParse(parsed);
    if (!result.success) {
      throw new BriefOpsError(`Invalid memory proposal ${filePath}: ${result.error.message}`);
    }
    return result.data;
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Memory proposal not found: ${id}`);
    }
    throw error;
  }
}

export async function listMemoryProposals(
  filters: ListMemoryProposalFilters = {}
): Promise<MemoryProposal[]> {
  const cwd = filters.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const project = filters.project ? normalizeName(filters.project) : undefined;
  const skill = filters.skill ? normalizeName(filters.skill) : undefined;
  const files = await listFilesBySuffix(workspacePaths(cwd).memoryProposals, ".memory-proposal.yaml");
  const proposals = await Promise.all(
    files.map(async (filePath) => {
      const parsed = YAML.parse(await readTextFile(filePath));
      const result = memoryProposalSchema.safeParse(parsed);
      if (!result.success) {
        throw new BriefOpsError(`Invalid memory proposal ${filePath}: ${result.error.message}`);
      }
      return result.data;
    })
  );

  return proposals
    .filter((proposal) => (filters.status ? proposal.status === filters.status : true))
    .filter((proposal) => (project ? proposal.project === project : true))
    .filter((proposal) => (skill ? proposal.skill === skill : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function applyMemoryProposal(options: {
  cwd?: string;
  id: string;
}): Promise<{ proposal: MemoryProposal; created: number; skipped: number }> {
  const cwd = options.cwd ?? process.cwd();
  const proposal = await readMemoryProposal(cwd, options.id);
  if (proposal.status !== "proposed") {
    throw new BriefOpsError(`Memory proposal is already ${proposal.status}: ${proposal.id}`);
  }

  let created = 0;
  let skipped = 0;
  for (const entry of proposal.items) {
    const result = await addMemoryIfMissing({
      cwd,
      type: entry.type,
      project: proposal.project,
      skill: proposal.skill,
      content: entry.content,
      status: entry.status,
      tags: entry.tags,
      source: entry.source ?? proposal.from_log,
      visibility: entry.visibility,
      exportable: entry.exportable
    });
    if (result.created) {
      created += 1;
    } else {
      skipped += 1;
    }
  }

  const updated = {
    ...proposal,
    status: "applied" as const,
    applied_at: new Date().toISOString()
  };
  await writeProposal(cwd, updated);
  return { proposal: updated, created, skipped };
}

export async function rejectMemoryProposal(options: {
  cwd?: string;
  id: string;
}): Promise<MemoryProposal> {
  const cwd = options.cwd ?? process.cwd();
  const proposal = await readMemoryProposal(cwd, options.id);
  if (proposal.status !== "proposed") {
    throw new BriefOpsError(`Memory proposal is already ${proposal.status}: ${proposal.id}`);
  }

  const updated = {
    ...proposal,
    status: "rejected" as const,
    rejected_at: new Date().toISOString()
  };
  await writeProposal(cwd, updated);
  return updated;
}
