"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { SnapshotManifest, Verification } from "@/db/schemas";

export function useVerificationsByRun(
  runId: string | null,
): Verification[] | undefined {
  return useLiveQuery(
    () => (runId ? db.verifications.where({ runId }).sortBy("createdAt") : []),
    [runId],
  );
}

export function useVerificationsByTier(
  runId: string | null,
  tier: number | null,
): Verification[] | undefined {
  return useLiveQuery(async () => {
    if (!runId || tier === null) return [];
    return db.verifications
      .where("[runId+tier]")
      .equals([runId, tier])
      .sortBy("createdAt");
  }, [runId, tier]);
}

export function useSnapshotManifests(
  runId: string | null,
): SnapshotManifest[] | undefined {
  return useLiveQuery(
    () =>
      runId
        ? db.snapshotManifests.where({ runId }).reverse().sortBy("createdAt")
        : [],
    [runId],
  );
}
