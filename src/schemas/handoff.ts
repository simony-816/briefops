import { z } from "zod";

export const handoffSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().datetime(),
  project: z.string().optional(),
  worker: z.string().optional(),
  task: z.string().optional(),
  adapter: z.string().default("generic"),
  budget: z.number().int().positive(),
  total_tokens: z.number().int().nonnegative(),
  warnings: z.array(z.string()).default([])
});

export type HandoffMetadata = z.infer<typeof handoffSchema>;
