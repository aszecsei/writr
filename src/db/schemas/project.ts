import { z } from "zod/v4";
import { ProjectIdSchema } from "./ids";
import { ImageSourceSchema, timestamp } from "./shared";

// ─── Project Mode ───────────────────────────────────────────────────

const ProjectModeEnum = z.enum(["prose", "screenplay"]);
export type ProjectMode = z.infer<typeof ProjectModeEnum>;

// ─── Project ─────────────────────────────────────────────────────────

export const ProjectSchema = z.object({
  id: ProjectIdSchema,
  title: z.string().min(1),
  description: z.string().default(""),
  genre: z.string().default(""),
  targetWordCount: z.number().int().nonnegative().default(0),
  mode: ProjectModeEnum.default("prose"),
  /** Cover art, displayed cropped to 2:3. "" means no cover. */
  coverImageUrl: ImageSourceSchema.default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Project = z.infer<typeof ProjectSchema>;
