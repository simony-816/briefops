import { memoryCategories, type MemoryCategory } from "./paths.js";
import { listMemory } from "./memory.js";
import type { MemoryItem } from "../schemas/memory.js";

export type MemoryHygieneReport = {
  counts: Record<MemoryCategory, number>;
  warnings: string[];
  duplicateLike: Array<{ ids: string[]; content: string }>;
  potentialConflicts: Array<{
    ids: [string, string];
    sharedTerms: string[];
    first: string;
    second: string;
  }>;
  oldActive: Array<{ item: MemoryItem; ageDays: number }>;
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

const conflictPositivePattern = /\b(always|must|required|require|requires|allow|allowed|approve|enable|use|prefer)\b/i;
const conflictNegativePattern = /\b(never|avoid|block|blocked|reject|disable|forbid|forbidden|disallow|do not|don't|must not)\b/i;

function conflictTerms(value: string): Set<string> {
  return new Set(
    normalizeContent(value)
      .split(" ")
      .filter((word) => word.length >= 4)
      .filter((word) => ![
        "always",
        "must",
        "required",
        "require",
        "requires",
        "allow",
        "allowed",
        "approve",
        "enable",
        "never",
        "avoid",
        "block",
        "blocked",
        "reject",
        "disable",
        "forbid",
        "forbidden",
        "disallow"
      ].includes(word))
  );
}

function polarity(value: string): "positive" | "negative" | "mixed" | "neutral" {
  const positive = conflictPositivePattern.test(value);
  const negative = conflictNegativePattern.test(value);
  if (negative) {
    return "negative";
  }
  if (positive) {
    return "positive";
  }
  return "neutral";
}

function findPotentialConflicts(items: MemoryItem[]): MemoryHygieneReport["potentialConflicts"] {
  const decisions = items.filter((item) => item.type === "decision" && item.status === "active");
  const conflicts: MemoryHygieneReport["potentialConflicts"] = [];
  for (let leftIndex = 0; leftIndex < decisions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < decisions.length; rightIndex += 1) {
      const left = decisions[leftIndex];
      const right = decisions[rightIndex];
      if (left.project !== right.project || left.skill !== right.skill) {
        continue;
      }
      const leftPolarity = polarity(left.content);
      const rightPolarity = polarity(right.content);
      const opposite =
        (leftPolarity === "positive" && rightPolarity === "negative") ||
        (leftPolarity === "negative" && rightPolarity === "positive");
      if (!opposite) {
        continue;
      }
      const leftTerms = conflictTerms(left.content);
      const sharedTerms = [...conflictTerms(right.content)].filter((term) => leftTerms.has(term));
      if (sharedTerms.length < 2) {
        continue;
      }
      conflicts.push({
        ids: [left.id, right.id],
        sharedTerms: sharedTerms.slice(0, 5),
        first: left.content,
        second: right.content
      });
    }
  }
  return conflicts;
}

function activeAgeDays(item: MemoryItem, now = Date.now()): number | undefined {
  if (item.status !== "active") {
    return undefined;
  }
  const created = Date.parse(item.created_at);
  if (Number.isNaN(created)) {
    return undefined;
  }
  return Math.floor((now - created) / 86_400_000);
}

export async function inspectMemoryHygiene(options: {
  cwd?: string;
  oldActiveDays?: number;
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
  const potentialConflicts = findPotentialConflicts(active);
  const oldActiveThreshold = options.oldActiveDays ?? 180;
  const oldActive = active
    .map((item) => ({ item, ageDays: activeAgeDays(item) }))
    .filter((entry): entry is { item: MemoryItem; ageDays: number } =>
      entry.ageDays !== undefined && entry.ageDays >= oldActiveThreshold
    );
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
  if (potentialConflicts.length > 0) {
    warnings.push("potentially conflicting decisions detected.");
  }
  if (oldActive.length > 0) {
    warnings.push("old active memory should be reviewed.");
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
    potentialConflicts,
    oldActive,
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
