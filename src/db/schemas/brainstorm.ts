import { z } from "zod/v4";
import { BrainstormIdeaIdSchema, BrainstormSetupIdSchema } from "./ids";
import { timestamp } from "./shared";

// ─── Brainstorm ──────────────────────────────────────────────────────

// A named column is a list of string options. Columns are embedded in their
// setup (meaningless on their own, always edited together), not a table.
const BrainstormColumnSchema = z.object({
  name: z.string().min(1),
  options: z.array(z.string()).default([]),
});
export type BrainstormColumn = z.infer<typeof BrainstormColumnSchema>;

export const BrainstormSetupSchema = z.object({
  id: BrainstormSetupIdSchema,
  name: z.string().min(1),
  columns: z.array(BrainstormColumnSchema).default([]),
  // Madlibs-style pattern referencing columns by name as [columnName].
  pattern: z.string().default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type BrainstormSetup = z.infer<typeof BrainstormSetupSchema>;

export const BrainstormIdeaSchema = z.object({
  id: BrainstormIdeaIdSchema,
  // The setup that produced this idea. Nullable (and not an enforced FK) so an
  // idea survives deletion of its setup.
  setupId: BrainstormSetupIdSchema.nullable().default(null),
  ideaText: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type BrainstormIdea = z.infer<typeof BrainstormIdeaSchema>;
