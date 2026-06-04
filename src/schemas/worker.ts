import { z } from "zod";

export const workerStatuses = ["active", "draft", "archived"] as const;

export const workerProfileSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  project: z.string().optional(),
  default_skills: z.array(z.string()).default([]),
  style: z.array(z.string()).default([]),
  max_tokens: z.number().int().positive().default(300),
  status: z.enum(workerStatuses).default("active")
});

export type WorkerProfile = z.infer<typeof workerProfileSchema>;
export type WorkerStatus = (typeof workerStatuses)[number];
