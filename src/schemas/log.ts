import { z } from "zod";

export const workLogSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().datetime(),
  project: z.string().optional(),
  skill: z.string().optional(),
  worker: z.string().optional(),
  task: z.string().min(1),
  result: z.string().min(1),
  lessons: z.array(z.string()).default([]),
  open_risks: z.array(z.string()).default([]),
  next_steps: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  incidents: z.array(z.string()).default([]),
  files_changed: z.array(z.string()).default([]),
  commands_run: z.array(z.string()).default([]),
  notes: z.string().default("")
});

export type WorkLog = z.infer<typeof workLogSchema>;
