import { db } from "../database";
import {
  type AgentNote,
  type AgentNoteCategory,
  AgentNoteSchema,
  type AgentNoteSeverity,
  type AgentNoteStatus,
  type AgentReference,
} from "../schemas";
import { generateId, now } from "./helpers";

export interface CreateAgentNoteInput {
  projectId: string;
  runId: string;
  chapterId?: string | null;
  category: AgentNoteCategory;
  severity: AgentNoteSeverity;
  description: string;
  references?: AgentReference[];
  sourceVerificationId?: string | null;
}

export async function createAgentNote(
  input: CreateAgentNoteInput,
): Promise<AgentNote> {
  const timestamp = now();
  const note = AgentNoteSchema.parse({
    id: generateId(),
    projectId: input.projectId,
    runId: input.runId,
    chapterId: input.chapterId ?? null,
    category: input.category,
    severity: input.severity,
    description: input.description,
    references: input.references ?? [],
    status: "open",
    addressedByWorkUnitId: null,
    sourceVerificationId: input.sourceVerificationId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.agentNotes.add(note);
  return note;
}

export async function getAgentNote(id: string): Promise<AgentNote | undefined> {
  return db.agentNotes.get(id);
}

export async function listAgentNotes(filter: {
  runId: string;
  status?: AgentNoteStatus;
  chapterId?: string | null;
}): Promise<AgentNote[]> {
  const collection = db.agentNotes.where({ runId: filter.runId });
  const all = await collection.toArray();
  let filtered = all;
  if (filter.status) {
    filtered = filtered.filter((n) => n.status === filter.status);
  }
  if (filter.chapterId !== undefined) {
    filtered = filtered.filter((n) => n.chapterId === filter.chapterId);
  }
  return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateAgentNote(
  id: string,
  data: Partial<
    Pick<
      AgentNote,
      | "description"
      | "category"
      | "severity"
      | "status"
      | "addressedByWorkUnitId"
      | "references"
      | "chapterId"
    >
  >,
): Promise<void> {
  await db.agentNotes.update(id, { ...data, updatedAt: now() });
}

export async function deleteAgentNote(id: string): Promise<void> {
  await db.agentNotes.delete(id);
}

/**
 * Count notes added to a run after the given timestamp. Used by the reader
 * loop's iteration-termination calculator.
 */
export async function countAgentNotesSince(
  runId: string,
  sinceIso: string,
): Promise<number> {
  return db.agentNotes
    .where({ runId })
    .filter((n) => n.createdAt > sinceIso)
    .count();
}
