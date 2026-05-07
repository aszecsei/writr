import { db } from "@/db/database";
import { listAgentNotes } from "@/db/operations/agentNotes";
import {
  getAgentRun,
  updateAgentRun,
  updateAgentRunStatus,
} from "@/db/operations/agentRuns";
import { getChapter, updateChapterContent } from "@/db/operations/chapters";
import { getEditPlanByRun } from "@/db/operations/editPlans";
import {
  listProposedEditsByRun,
  updateProposedEditStatus,
} from "@/db/operations/proposedEdits";
import { listBiblePaths } from "@/db/operations/readerBible";
import { createSnapshotManifest } from "@/db/operations/snapshotManifests";
import { createSnapshot } from "@/db/operations/snapshots";
import { listWorkUnitsByTier, updateWorkUnit } from "@/db/operations/workUnits";
import type {
  AgentRunId,
  ChapterId,
  ChapterSnapshotId,
  ProjectId,
  ProposedEdit,
  ProposedEditId,
  SnapshotManifestId,
} from "@/db/schemas";
import { applyEditsToContent } from "./stagedChapterContent";

export interface ApplyTierOptions {
  runId: AgentRunId;
  projectId: ProjectId;
  tier: number;
  /** Only edits with these ids will be applied. */
  approvedEditIds: ProposedEditId[];
  /** Optional human-supplied label for the resulting snapshot manifest. */
  manifestName?: string;
}

export interface ApplyTierResult {
  manifestId: SnapshotManifestId;
  appliedEditIds: ProposedEditId[];
  rejectedEditIds: ProposedEditId[];
  discardedEditIds: ProposedEditId[];
  affectedChapterIds: ChapterId[];
}

/**
 * Atomically commit a tier:
 *   1. Snapshot every chapter that will change (via existing createSnapshot).
 *   2. Capture the reader bible / notes / work units inline on the manifest.
 *   3. Apply approved edits in reverse-offset order (offsets stay stable).
 *   4. Mark edits applied/rejected, work units applied, advance currentTier.
 *
 * Edits whose anchor can't be located are marked `discarded` (with a note
 * appended in a follow-up — Phase 3 wires that up).
 */
export async function applyTier(
  options: ApplyTierOptions,
): Promise<ApplyTierResult> {
  const { runId, projectId, tier, approvedEditIds, manifestName } = options;
  await updateAgentRunStatus(runId, "applying-tier");

  const run = await getAgentRun(runId);
  if (!run) throw new Error(`Agent run not found: ${runId}`);

  const plan = await getEditPlanByRun(runId);
  if (!plan) throw new Error(`No edit plan for run ${runId}`);
  const planTier = plan.tiers.find((t) => t.tierNumber === tier);
  if (!planTier) throw new Error(`Tier ${tier} not on plan`);

  const allEdits = await listProposedEditsByRun(runId);
  const tierWorkUnits = await listWorkUnitsByTier(runId, tier);
  const wuSet = new Set(tierWorkUnits.map((u) => u.id));
  const tierEdits = allEdits.filter((e) => wuSet.has(e.workUnitId));

  const approvedSet = new Set(approvedEditIds);
  const approvedEdits = tierEdits.filter((e) => approvedSet.has(e.id));
  const rejectedEdits = tierEdits.filter(
    (e) => !approvedSet.has(e.id) && e.status === "pending",
  );

  // Group approved edits by chapter so we patch each chapter in one pass.
  const byChapter = new Map<ChapterId, ProposedEdit[]>();
  for (const edit of approvedEdits) {
    const list = byChapter.get(edit.chapterId) ?? [];
    list.push(edit);
    byChapter.set(edit.chapterId, list);
  }

  // 1) Snapshot affected chapters BEFORE applying edits.
  const chapterSnapshotIds: ChapterSnapshotId[] = [];
  for (const chapterId of byChapter.keys()) {
    const chapter = await getChapter(chapterId);
    if (!chapter) continue;
    const snap = await createSnapshot({
      chapterId: chapter.id,
      projectId: chapter.projectId,
      name: manifestName
        ? `${manifestName} (pre-apply)`
        : `Tier ${tier} pre-apply`,
      content: chapter.content,
      wordCount: chapter.wordCount,
    });
    chapterSnapshotIds.push(snap.id);
  }

  // 2) Reader bible + notes + work units snapshot inline on the manifest.
  const [bibleView, notesSnapshot] = await Promise.all([
    listBiblePaths(runId),
    listAgentNotes({ runId }),
  ]);

  // 3) Apply edits per chapter (reverse offset order handled in the helper).
  const appliedEditIds: ProposedEditId[] = [];
  const discardedEditIds: ProposedEditId[] = [];

  for (const [chapterId, edits] of byChapter.entries()) {
    const chapter = await getChapter(chapterId);
    if (!chapter) {
      discardedEditIds.push(...edits.map((e) => e.id));
      continue;
    }
    const {
      content: nextContent,
      applied,
      skipped,
    } = applyEditsToContent(chapter.content, edits);
    appliedEditIds.push(...applied);
    discardedEditIds.push(...skipped);
    if (applied.length > 0) {
      await updateChapterContent(
        chapter.id,
        nextContent,
        countWords(nextContent),
      );
    }
  }

  // 4) Mark statuses and advance the run.
  await db.transaction(
    "rw",
    db.proposedEdits,
    db.workUnits,
    db.agentRuns,
    db.snapshotManifests,
    async () => {
      for (const id of appliedEditIds) {
        await updateProposedEditStatus(id, "applied");
      }
      for (const id of discardedEditIds) {
        await updateProposedEditStatus(id, "discarded");
      }
      for (const e of rejectedEdits) {
        await updateProposedEditStatus(e.id, "rejected");
      }

      // A work unit is "applied" if at least one of its edits got applied;
      // otherwise "rejected".
      for (const wu of tierWorkUnits) {
        const wuEdits = tierEdits.filter((e) => e.workUnitId === wu.id);
        const anyApplied = wuEdits.some((e) => appliedEditIds.includes(e.id));
        await updateWorkUnit(wu.id, {
          status: anyApplied ? "applied" : "rejected",
        });
      }
    },
  );

  // 5) Persist manifest after the chapter writes succeeded.
  const manifest = await createSnapshotManifest({
    projectId,
    runId,
    tierNumber: tier,
    name: manifestName ?? `Tier ${tier} apply`,
    chapterSnapshotIds,
    readerBibleSnapshot: {
      view: bibleView,
      logCutoffEntryId: null,
    },
    notesSnapshot,
    workUnitsSnapshot: tierWorkUnits,
  });

  await updateAgentRun(runId, {
    currentTier: tier + 1,
    currentSnapshotManifestId: manifest.id,
  });
  await updateAgentRunStatus(
    runId,
    "awaiting-plan-approval",
    `Tier ${tier} applied: ${appliedEditIds.length} edits, ${discardedEditIds.length} discarded, ${rejectedEdits.length} rejected.`,
  );

  return {
    manifestId: manifest.id,
    appliedEditIds,
    rejectedEditIds: rejectedEdits.map((e) => e.id),
    discardedEditIds,
    affectedChapterIds: [...byChapter.keys()],
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
