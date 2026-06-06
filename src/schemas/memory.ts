import { z } from "zod";

export const memoryItemTypes = ["fact", "decision", "lesson", "incident", "deprecated"] as const;
export const memoryStatuses = ["active", "stale", "deprecated", "superseded", "archived"] as const;
export const memoryVisibilities = ["private", "shared", "public"] as const;

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
  exportable: z.boolean().default(false)
});

export const memoryFileSchema = z.object({
  items: z.array(memoryItemSchema).default([])
});

export type MemoryItem = z.infer<typeof memoryItemSchema>;
export type MemoryStatus = (typeof memoryStatuses)[number];
export type MemoryVisibility = (typeof memoryVisibilities)[number];
export type MemoryFile = z.infer<typeof memoryFileSchema>;
