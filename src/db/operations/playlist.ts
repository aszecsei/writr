import { db } from "../database";
import {
  type PlaylistTrack,
  type PlaylistTrackId,
  PlaylistTrackSchema,
  type ProjectId,
} from "../schemas";
import {
  generateId,
  getNextOrder,
  now,
  reorderEntities,
  stripUndefined,
} from "./helpers";

// ─── Playlist Tracks ─────────────────────────────────────────────────

export async function createPlaylistTrack(
  data: Pick<PlaylistTrack, "projectId" | "title" | "url" | "source"> &
    Partial<Pick<PlaylistTrack, "thumbnailUrl" | "duration" | "order">>,
): Promise<PlaylistTrack> {
  const order = await getNextOrder(
    db.playlistTracks,
    { projectId: data.projectId },
    data.order,
  );
  const track = PlaylistTrackSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    url: data.url,
    source: data.source,
    thumbnailUrl: data.thumbnailUrl ?? "",
    duration: data.duration ?? 0,
    order,
    createdAt: now(),
    updatedAt: now(),
  });
  await db.playlistTracks.add(track);
  return track;
}

export async function deletePlaylistTrack(id: PlaylistTrackId): Promise<void> {
  await db.playlistTracks.delete(id);
}

export async function reorderPlaylistTracks(
  orderedIds: PlaylistTrackId[],
): Promise<void> {
  return reorderEntities(db.playlistTracks, orderedIds);
}
