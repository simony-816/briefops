import { z } from "zod";

export const skillPatchStatuses = ["proposed", "applied", "rejected"] as const;

export const skillPatchSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().datetime(),
  skill: z.string().min(1),
  from_log: z.string().min(1),
  status: z.enum(skillPatchStatuses).default("proposed"),
  target_section: z.string().default("Check"),
  lessons: z.array(z.string()).default([]),
  additions: z.array(z.string()).default([]),
  applied_at: z.string().datetime().optional(),
  rejected_at: z.string().datetime().optional()
});

export type SkillPatch = z.infer<typeof skillPatchSchema>;
export type SkillPatchStatus = (typeof skillPatchStatuses)[number];
