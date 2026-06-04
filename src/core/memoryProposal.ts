import path from "node:path";
import { BriefOpsError } from "./errors.js";
import { readWorkLog } from "./log.js";
import { addMemoryIfMissing } from "./memory.js";
import { formatDateStamp, memoryProposalFilePath, normalizeName, workspacePaths } from "./paths.js";
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

function proposalId(date = new Date()): string {
  return `memprop_${formatDateStamp(date)}`;
}

function tagsFromText(value: string): string[] {
  const tags = value
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/i)
    .filter((word) => word.length >= 4)
    .slice(0, 6);
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
      type: prefix,
      status: "active" as const,
      content,
      tags: tagsFromText(content),
      rationale: `Extracted from work log note prefix: ${prefix}.`
    }));
}

function isIncidentCandidate(result: string): boolean {
  return /\b(missed|failed|blocked|bug|risk|missing|failure|error)\b/i.test(result);
}

async function writeProposal(cwd: string, proposal: MemoryProposal): Promise<string> {
  const filePath = memoryProposalFilePath(cwd, proposal.id);
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
    ...log.lessons.map((lesson) => ({
      type: "lesson" as const,
      status: "active" as const,
      content: lesson.trim(),
      tags: tagsFromText(lesson),
      rationale: "Extracted from work log lesson."
    })),
    ...extractPrefixedNotes(log.notes, "decision"),
    ...extractPrefixedNotes(log.notes, "fact")
  ];

  if (isIncidentCandidate(log.result)) {
    proposals.push({
      type: "incident",
      status: "active",
      content: log.result.trim(),
      tags: tagsFromText(log.result),
      rationale: "Extracted from work log result because it contains failure/risk language."
    });
  }

  if (proposals.length === 0) {
    throw new BriefOpsError(`No memory proposal candidates found in log: ${log.id}`);
  }

  const proposal = memoryProposalSchema.parse({
    id: proposalId(new Date(createdAt)),
    created_at: createdAt,
    from_log: log.id,
    status: "proposed",
    project: log.project,
    skill: log.skill,
    worker: log.worker,
    proposals
  });
  return {
    path: await writeProposal(cwd, proposal),
    proposal
  };
}

export async function readMemoryProposal(cwd: string, id: string): Promise<MemoryProposal> {
  await requireWorkspace(cwd);
  const normalized = normalizeName(id);
  const filePath = memoryProposalFilePath(cwd, normalized);
  try {
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
    files.map(async (filePath) => readMemoryProposal(cwd, path.basename(filePath, ".memory-proposal.yaml")))
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
  for (const entry of proposal.proposals) {
    const result = await addMemoryIfMissing({
      cwd,
      type: entry.type,
      project: proposal.project,
      skill: proposal.skill,
      content: entry.content,
      status: entry.status,
      tags: entry.tags,
      source: `proposal:${proposal.id}`
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
