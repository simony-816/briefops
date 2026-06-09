import { memoryCategories, type MemoryCategory } from "./paths.js";
import { listMemory } from "./memory.js";
import type { MemoryItem } from "../schemas/memory.js";

export type MemoryHygieneReport = {
  counts: Record<MemoryCategory, number>;
  warnings: string[];
  duplicateLike: Array<{ ids: string[]; content: string }>;
  stale: MemoryItem[];
  deprecated: MemoryItem[];
};

export type MemoryPrunePlan = {
  archive: Array<{ id: string; reason: string; content: string }>;
};

const thresholds: Record<MemoryCategory, number> = {
  facts: 30,
  decisions: 30,
  lessons: 40,
  incidents: 25,
  deprecated: 0
};

const categoryTypes: Record<MemoryCategory, MemoryItem["type"]> = {
  facts: "fact",
  decisions: "decision",
  lessons: "lesson",
  incidents: "incident",
  deprecated: "deprecated"
};

function normalizeContent(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findDuplicateLike(items: MemoryItem[]): Array<{ ids: string[]; content: string }> {
  const groups = new Map<string, MemoryItem[]>();
  for (const item of items) {
    const key = normalizeContent(item.content);
    if (!key) {
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      ids: group.map((item) => item.id),
      content: group[0].content
    }));
}

export async function inspectMemoryHygiene(options: {
  cwd?: string;
} = {}): Promise<MemoryHygieneReport> {
  const cwd = options.cwd ?? process.cwd();
  const active = await listMemory({ cwd, status: "active" });
  const all = await listMemory({ cwd });
  const counts = Object.fromEntries(
    memoryCategories.map((category) => [
      category,
      active.filter((item) => item.type === categoryTypes[category]).length
    ])
  ) as Record<MemoryCategory, number>;
  const duplicateLike = findDuplicateLike(active);
  const stale = all.filter((item) => item.status === "stale");
  const deprecated = all.filter((item) => item.status === "deprecated" || item.type === "deprecated");
  const warnings: string[] = [];
  for (const category of memoryCategories) {
    if (category !== "deprecated" && counts[category] > thresholds[category]) {
      warnings.push(`${category} active memory count is high.`);
    }
  }
  if (duplicateLike.length > 0) {
    warnings.push("duplicate-like memories detected.");
  }
  if (stale.length > 0) {
    warnings.push("stale memory exists.");
  }
  if (deprecated.length > 0) {
    warnings.push("deprecated memory exists.");
  }

  return {
    counts,
    warnings,
    duplicateLike,
    stale,
    deprecated
  };
}

export async function planMemoryPrune(options: {
  cwd?: string;
} = {}): Promise<MemoryPrunePlan> {
  const report = await inspectMemoryHygiene(options);
  const archive = [
    ...report.stale.map((item) => ({
      id: item.id,
      reason: "stale memory",
      content: item.content
    })),
    ...report.deprecated.map((item) => ({
      id: item.id,
      reason: "deprecated memory",
      content: item.content
    })),
    ...report.duplicateLike.flatMap((group) =>
      group.ids.slice(1).map((id) => ({
        id,
        reason: "duplicate-like memory",
        content: group.content
      }))
    )
  ];

  return { archive };
}
