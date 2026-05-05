import { db } from "@/db/database";
import {
  updateAgentRun,
  updateAgentRunStatus,
} from "@/db/operations/agentRuns";
import { updateChapterContent } from "@/db/operations/chapters";
import {
  getSnapshotManifest,
  listSnapshotManifestsByRun,
} from "@/db/operations/snapshotManifests";
import { getSnapshot } from "@/db/operations/snapshots";

export interface RevertTierOptions {
  runId: string;
  projectId: string;
  /** The manifest to restore the project to. Downstream manifests are discarded. */
  manifestId: string;
}

export interface RevertTierResult {
  restoredChapterIds: string[];
  discardedManifestIds: string[];
  discardedTiers: number[];
}

/**
 * Restore the project to a snapshot manifest. All downstream tiers (work
 * units, proposed edits, verifications, manifests) are deleted; reader bible
 * / notes from BEFORE the manifest stay valid (the reader's manuscript view
 * hadn't changed yet — only the orchestrator's plan needs re-deriving).
 *
 * Notes that were marked addressed by a now-deleted work unit are restored
 * to status=open so the next planning round can pick them up.
 */
export async function revertTier(
  options: RevertTierOptions,
): Promise<RevertTierResult> {
  const { runId, projectId, manifestId } = options;

  const target = await getSnapshotManifest(manifestId);
  if (!target) throw new Error(`Snapshot manifest not found: ${manifestId}`);
  if (target.runId !== runId)
    throw new Error("Manifest belongs to a different run");

  const allManifests = await listSnapshotManifestsByRun(runId);
  // Manifests strictly newer than the target are discarded.
  const downstream = allManifests.filter((m) => m.createdAt > target.createdAt);

  // 1) Restore chapter content from the target manifest's snapshots.
  const restoredChapterIds: string[] = [];
  for (const snapshotId of target.chapterSnapshotIds) {
    const snap = await getSnapshot(snapshotId);
    if (!snap) continue;
    await updateChapterContent(snap.chapterId, snap.content, snap.wordCount);
    restoredChapterIds.push(snap.chapterId);
  }

  // 2) Restore reader-bible view from the manifest. Truncate the log.
  await db.transaction(
    "rw",
    db.readerBibleView,
    db.readerBibleLog,
    async () => {
      const existingView = await db.readerBibleView
        .where({ projectId })
        .toArray();
      for (const row of existingView) {
        await db.readerBibleView.delete(row.id);
      }
      for (const row of target.readerBibleSnapshot.view) {
        await db.readerBibleView.put(row);
      }
      // Truncate log to entries created at or before the manifest.
      const log = await db.readerBibleLog.where({ projectId }).toArray();
      for (const entry of log) {
        if (entry.createdAt > target.createdAt) {
          await db.readerBibleLog.delete(entry.id);
        }
      }
    },
  );

  // 3) Discard downstream proposed edits, work units, verifications, manifests.
  const discardedTiers: number[] = [];
  const discardedManifestIds: string[] = [];

  await db.transaction(
    "rw",
    [
      db.snapshotManifests,
      db.proposedEdits,
      db.workUnits,
      db.verifications,
      db.editPlans,
      db.agentNotes,
      db.agentRuns,
    ],
    async () => {
      // Discard manifests strictly after the target.
      for (const m of downstream) {
        await db.snapshotManifests.delete(m.id);
        discardedManifestIds.push(m.id);
        if (!discardedTiers.includes(m.tierNumber)) {
          discardedTiers.push(m.tierNumber);
        }
      }

      // Find work units that belong to discarded tiers (or post-target tiers
      // that never produced a manifest because the user reverted mid-flight).
      const allUnits = await db.workUnits.where({ runId }).toArray();
      const survivingUnitIds = new Set<string>();
      for (const u of allUnits) {
        if (u.tier <= target.tierNumber) {
          survivingUnitIds.add(u.id);
        } else {
          await db.workUnits.delete(u.id);
        }
      }

      // Discard proposed edits attached to deleted work units.
      const allEdits = await db.proposedEdits.where({ runId }).toArray();
      for (const e of allEdits) {
        if (!survivingUnitIds.has(e.workUnitId)) {
          await db.proposedEdits.delete(e.id);
        }
      }

      // Discard verifications for tiers > target.
      const allVerifications = await db.verifications
        .where({ runId })
        .toArray();
      for (const v of allVerifications) {
        if (v.tier > target.tierNumber) {
          await db.verifications.delete(v.id);
        }
      }

      // Trim plan tiers strictly above the target.
      const plan = await db.editPlans.where({ runId }).first();
      if (plan) {
        const survivingTiers = plan.tiers.filter(
          (t) => t.tierNumber <= target.tierNumber,
        );
        await db.editPlans.update(plan.id, {
          status: "draft",
          currentTier: target.tierNumber,
          tiers: survivingTiers,
          updatedAt: new Date().toISOString(),
        });
      }

      // Restore notes whose addressedByWorkUnitId points to a deleted unit.
      const allNotes = await db.agentNotes.where({ runId }).toArray();
      for (const note of allNotes) {
        if (
          note.addressedByWorkUnitId &&
          !survivingUnitIds.has(note.addressedByWorkUnitId)
        ) {
          await db.agentNotes.update(note.id, {
            status: "open",
            addressedByWorkUnitId: null,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Reset run pointer + status.
      await db.agentRuns.update(runId, {
        currentTier: target.tierNumber,
        currentSnapshotManifestId: target.id,
        requiresIncrementalReread: false,
        updatedAt: new Date().toISOString(),
      });
    },
  );

  await updateAgentRun(runId, {
    currentTier: target.tierNumber,
    currentSnapshotManifestId: target.id,
    requiresIncrementalReread: false,
  });
  await updateAgentRunStatus(
    runId,
    "awaiting-plan-approval",
    `Reverted to tier ${target.tierNumber}. ${restoredChapterIds.length} chapter${
      restoredChapterIds.length === 1 ? "" : "s"
    } restored; ${discardedTiers.length} downstream tier${
      discardedTiers.length === 1 ? "" : "s"
    } discarded.`,
  );

  return {
    restoredChapterIds,
    discardedManifestIds,
    discardedTiers,
  };
}
