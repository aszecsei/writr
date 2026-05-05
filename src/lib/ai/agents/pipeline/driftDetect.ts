import { listSnapshotManifestsByRun } from "@/db/operations/snapshotManifests";
import { listVerificationsByRun } from "@/db/operations/verifications";

/**
 * Compute the chapter ids that have been touched by recent tiers but not yet
 * re-read by the Reader. Used to scope an incremental Reader pass when the
 * verifier flags drift — the Reader doesn't need to re-process the whole
 * manuscript, just the changed chapters.
 *
 * Returns the chapters from the latest applied manifest. Phase 4 can refine
 * this to track multiple unprocessed manifests if drift accumulates.
 */
export async function getChaptersAwaitingReread(
  runId: string,
): Promise<string[]> {
  const manifests = await listSnapshotManifestsByRun(runId);
  if (manifests.length === 0) return [];
  // Manifests are already sorted by createdAt asc — newest is last.
  const latest = manifests[manifests.length - 1];
  return [...new Set(latest.chapterSnapshotIds)];
}

/**
 * True iff the verifier produced any contradictions / continuity breaks since
 * the run was last read. (Caller usually relies on the run's
 * `requiresIncrementalReread` flag — this is the recompute path.)
 */
export async function hasDrift(runId: string): Promise<boolean> {
  const verifications = await listVerificationsByRun(runId);
  return verifications.some(
    (v) => v.contradictions.length > 0 || v.continuityBreaks.length > 0,
  );
}
