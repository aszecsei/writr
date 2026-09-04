import { db } from "../database";
import {
  type PlaylistTrack,
  type PlaylistTrackId,
  PlaylistTrackSchema,
} from "../schemas";
import {
  createCrud,
  generateId,
  nextOrder,
  now,
  reorderEntities,
} from "./helpers";

// ─── Playlist Tracks ─────────────────────────────────────────────────

export async function createPlaylistTrack(
  data: Pick<PlaylistTrack, "projectId" | "title" | "url" | "source"> &
    Partial<Pick<PlaylistTrack, "thumbnailUrl" | "duration" | "order">>,
): Promise<PlaylistTrack> {
  const order = await nextOrder(
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

export const deletePlaylistTrack = createCrud<PlaylistTrack, PlaylistTrackId>(
  db.playlistTracks,
).delete;

export async function reorderPlaylistTracks(
  orderedIds: PlaylistTrackId[],
): Promise<void> {
  return reorderEntities(db.playlistTracks, orderedIds);
}
