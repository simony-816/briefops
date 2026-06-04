import { z } from "zod";
import { memoryItemTypes, memoryStatuses } from "./memory.js";

export const memoryProposalStatuses = ["proposed", "applied", "rejected"] as const;

export const memoryProposalEntrySchema = z.object({
  type: z.enum(memoryItemTypes),
  status: z.enum(memoryStatuses).default("active"),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  rationale: z.string().default("")
});

export const memoryProposalSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().datetime(),
  from_log: z.string().min(1),
  status: z.enum(memoryProposalStatuses).default("proposed"),
  project: z.string().optional(),
  skill: z.string().optional(),
  worker: z.string().optional(),
  proposals: z.array(memoryProposalEntrySchema).default([]),
  applied_at: z.string().datetime().optional(),
  rejected_at: z.string().datetime().optional()
});

export type MemoryProposal = z.infer<typeof memoryProposalSchema>;
export type MemoryProposalEntry = z.infer<typeof memoryProposalEntrySchema>;
export type MemoryProposalStatus = (typeof memoryProposalStatuses)[number];
