import { db } from "../database";
import {
  type AgentNote,
  type AgentNoteCategory,
  type AgentNoteId,
  AgentNoteSchema,
  type AgentNoteSeverity,
  type AgentNoteStatus,
  type AgentReference,
  type AgentRunId,
  type ChapterId,
  type ProjectId,
  type VerificationId,
} from "../schemas";
import { generateId, now } from "./helpers";

export interface CreateAgentNoteInput {
  projectId: ProjectId;
  runId: AgentRunId;
  chapterId?: ChapterId | null;
  category: AgentNoteCategory;
  severity: AgentNoteSeverity;
  description: string;
  references?: AgentReference[];
  sourceVerificationId?: VerificationId | null;
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

export async function getAgentNote(
  id: AgentNoteId,
): Promise<AgentNote | undefined> {
  return db.agentNotes.get(id);
}

export async function listAgentNotes(filter: {
  runId: AgentRunId;
  status?: AgentNoteStatus;
  chapterId?: ChapterId | null;
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
  id: AgentNoteId,
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

export async function deleteAgentNote(id: AgentNoteId): Promise<void> {
  await db.agentNotes.delete(id);
}

/**
 * Count notes added to a run after the given timestamp. Used by the reader
 * loop's iteration-termination calculator.
 */
export async function countAgentNotesSince(
  runId: AgentRunId,
  sinceIso: string,
): Promise<number> {
  return db.agentNotes
    .where({ runId })
    .filter((n) => n.createdAt > sinceIso)
    .count();
}
