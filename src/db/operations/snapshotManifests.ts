import { db } from "../database";
import {
  type AgentRunId,
  type SnapshotManifest,
  type SnapshotManifestId,
  SnapshotManifestSchema,
} from "../schemas";
import { generateId, now } from "./helpers";

export type CreateSnapshotManifestInput = Omit<
  SnapshotManifest,
  "id" | "createdAt"
>;

export async function createSnapshotManifest(
  input: CreateSnapshotManifestInput,
): Promise<SnapshotManifest> {
  const manifest = SnapshotManifestSchema.parse({
    id: generateId(),
    ...input,
    createdAt: now(),
  });
  await db.snapshotManifests.add(manifest);
  return manifest;
}

export async function getSnapshotManifest(
  id: SnapshotManifestId,
): Promise<SnapshotManifest | undefined> {
  return db.snapshotManifests.get(id);
}

export async function listSnapshotManifestsByRun(
  runId: AgentRunId,
): Promise<SnapshotManifest[]> {
  return db.snapshotManifests.where({ runId }).sortBy("createdAt");
}

export async function deleteSnapshotManifest(
  id: SnapshotManifestId,
): Promise<void> {
  await db.snapshotManifests.delete(id);
}
