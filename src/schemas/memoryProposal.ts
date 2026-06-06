import { z } from "zod";
import { memoryCategories } from "../core/paths.js";
import { memoryItemTypes, memoryStatuses, memoryVisibilities } from "./memory.js";

export const memoryProposalStatuses = ["proposed", "applied", "rejected"] as const;

export const memoryProposalEntrySchema = z.object({
  category: z.enum(memoryCategories).optional(),
  type: z.enum(memoryItemTypes),
  status: z.enum(memoryStatuses).default("active"),
  content: z.string().min(1),
  source: z.string().optional(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(memoryVisibilities).default("private"),
  exportable: z.boolean().default(false),
  rationale: z.string().default("")
}).transform((entry) => ({
  ...entry,
  category: entry.category ?? ({
    fact: "facts",
    decision: "decisions",
    lesson: "lessons",
    incident: "incidents",
    deprecated: "deprecated"
  } as const)[entry.type]
}));

const rawMemoryProposalSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().datetime(),
  from_log: z.string().min(1),
  status: z.enum(memoryProposalStatuses).default("proposed"),
  project: z.string().optional(),
  skill: z.string().optional(),
  worker: z.string().optional(),
  items: z.array(memoryProposalEntrySchema).default([]),
  applied_at: z.string().datetime().optional(),
  rejected_at: z.string().datetime().optional()
});

export const memoryProposalSchema = z.preprocess((value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (!record.items && Array.isArray(record.proposals)) {
      return { ...record, items: record.proposals };
    }
  }
  return value;
}, rawMemoryProposalSchema);

export type MemoryProposal = z.infer<typeof memoryProposalSchema>;
export type MemoryProposalEntry = z.infer<typeof memoryProposalEntrySchema>;
export type MemoryProposalStatus = (typeof memoryProposalStatuses)[number];
