import { z } from "zod";

export const evalScoringSchema = z.object({
  type: z.literal("checklist").default("checklist"),
  pass_threshold: z.number().int().positive().optional()
});

export const evalCaseSchema = z.object({
  id: z.string().min(1),
  skill: z.string().optional(),
  project: z.string().optional(),
  worker: z.string().optional(),
  description: z.string().default(""),
  input: z.string().default(""),
  expected: z.array(z.string()).default([]),
  scoring: evalScoringSchema.default({ type: "checklist" })
});

export const evalResultSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().datetime(),
  case_id: z.string().min(1),
  skill: z.string().optional(),
  project: z.string().optional(),
  worker: z.string().optional(),
  passed: z.boolean(),
  score: z.number().int().nonnegative(),
  pass_threshold: z.number().int().positive(),
  matched: z.array(z.string()).default([]),
  missing: z.array(z.string()).default([]),
  brief_tokens: z.number().int().nonnegative()
});

export type EvalCase = z.infer<typeof evalCaseSchema>;
export type EvalResult = z.infer<typeof evalResultSchema>;
