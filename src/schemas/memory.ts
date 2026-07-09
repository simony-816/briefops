import { z } from "zod";

export const memoryItemTypes = ["fact", "decision", "lesson", "incident", "deprecated"] as const;
export const memoryStatuses = ["active", "stale", "deprecated", "superseded", "archived"] as const;
export const memoryVisibilities = ["private", "shared", "public"] as const;
export const memoryConfidences = ["verified", "unverified"] as const;

export const memoryEvidenceSchema = z.object({
  path: z.string().min(1),
  start_line: z.number().int().positive().optional(),
  end_line: z.number().int().positive().optional(),
  sha256: z.string().min(6).optional(),
  note: z.string().optional()
});

export const memoryItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(memoryItemTypes),
  status: z.enum(memoryStatuses).default("active"),
  project: z.string().optional(),
  skill: z.string().optional(),
  content: z.string().min(1),
  source: z.string().default("manual"),
  created_at: z.string().datetime(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(memoryVisibilities).default("private"),
  exportable: z.boolean().default(false),
  evidence: z.array(memoryEvidenceSchema).default([]),
  confidence: z.enum(memoryConfidences).default("verified"),
  last_verified_at: z.string().datetime().optional(),
  supersedes: z.array(z.string().min(1)).default([])
});

export const memoryFileSchema = z.object({
  items: z.array(memoryItemSchema).default([])
});

export type MemoryItem = z.infer<typeof memoryItemSchema>;
export type MemoryEvidence = z.infer<typeof memoryEvidenceSchema>;
export type MemoryStatus = (typeof memoryStatuses)[number];
export type MemoryVisibility = (typeof memoryVisibilities)[number];
export type MemoryFile = z.infer<typeof memoryFileSchema>;
