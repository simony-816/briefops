import { z } from "zod";

export const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  version: z.string().default("0.1.0"),
  description: z.string().default(""),
  max_tokens: z.number().int().positive().default(700),
  tags: z.array(z.string()).default([])
});

export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

export type SkillDocument = {
  data: SkillFrontmatter;
  body: string;
  raw: string;
};
