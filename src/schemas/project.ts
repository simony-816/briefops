import { z } from "zod";

export const projectFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  max_tokens: z.number().int().positive().default(500),
  tags: z.array(z.string()).default([])
});

export type ProjectFrontmatter = z.infer<typeof projectFrontmatterSchema>;

export type ProjectDocument = {
  data: ProjectFrontmatter;
  body: string;
  raw: string;
};
