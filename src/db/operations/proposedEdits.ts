import { db } from "../database";
import {
  type ProposedEdit,
  type ProposedEditKind,
  ProposedEditSchema,
  type ProposedEditStatus,
} from "../schemas";
import { generateId, now } from "./helpers";

export interface CreateProposedEditInput {
  projectId: string;
  runId: string;
  workUnitId: string;
  chapterId: string;
  kind: ProposedEditKind;
  /** `insert_at` only. */
  fromOffset?: number;
  /** Required for `replace`; optional fallback locator for `insert_at`. */
  anchorText?: string;
  /** `replace` only — disambiguation context concatenated before `anchorText`. */
  prefix?: string;
  /** `replace` only — disambiguation context concatenated after `anchorText`. */
  suffix?: string;
  newContent: string;
  rationale?: string;
}

export async function createProposedEdit(
  input: CreateProposedEditInput,
): Promise<ProposedEdit> {
  const timestamp = now();
  const edit = ProposedEditSchema.parse({
    id: generateId(),
    projectId: input.projectId,
    runId: input.runId,
    workUnitId: input.workUnitId,
    chapterId: input.chapterId,
    kind: input.kind,
    fromOffset: input.fromOffset,
    anchorText: input.anchorText,
    prefix: input.prefix,
    suffix: input.suffix,
    newContent: input.newContent,
    rationale: input.rationale ?? "",
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.proposedEdits.add(edit);
  return edit;
}

export async function getProposedEdit(
  id: string,
): Promise<ProposedEdit | undefined> {
  return db.proposedEdits.get(id);
}

export async function listProposedEditsByRun(
  runId: string,
): Promise<ProposedEdit[]> {
  return db.proposedEdits.where({ runId }).sortBy("createdAt");
}

export async function listProposedEditsByWorkUnit(
  workUnitId: string,
): Promise<ProposedEdit[]> {
  return db.proposedEdits.where({ workUnitId }).sortBy("createdAt");
}

export async function listProposedEditsByChapter(
  runId: string,
  chapterId: string,
): Promise<ProposedEdit[]> {
  const all = await db.proposedEdits.where({ runId }).toArray();
  return all
    .filter((e) => e.chapterId === chapterId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Approved edits for a chapter, in insertion order. `applyEditsToContent`
 * re-sorts by *resolved* range position (after locating each anchor) so the
 * apply phase doesn't depend on a meaningful comparator here — `replace`
 * edits don't carry an offset to sort by.
 */
export async function listApprovedEditsForChapter(
  runId: string,
  chapterId: string,
): Promise<ProposedEdit[]> {
  const all = await db.proposedEdits.where({ runId }).toArray();
  return all
    .filter((e) => e.chapterId === chapterId && e.status === "approved")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateProposedEditStatus(
  id: string,
  status: ProposedEditStatus,
): Promise<void> {
  await db.proposedEdits.update(id, { status, updatedAt: now() });
}

export async function deleteProposedEdit(id: string): Promise<void> {
  await db.proposedEdits.delete(id);
}
