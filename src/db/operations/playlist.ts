import { db } from "../database";
import { type PlaylistTrack, PlaylistTrackSchema } from "../schemas";
import { generateId, now, reorderEntities } from "./helpers";

// ─── Playlist Tracks ─────────────────────────────────────────────────

export async function getPlaylistByProject(
  projectId: string,
): Promise<PlaylistTrack[]> {
  return db.playlistTracks.where({ projectId }).sortBy("order");
}

export async function getPlaylistTrack(
  id: string,
): Promise<PlaylistTrack | undefined> {
  return db.playlistTracks.get(id);
}

export async function createPlaylistTrack(
  data: Pick<PlaylistTrack, "projectId" | "title" | "url" | "source"> &
    Partial<Pick<PlaylistTrack, "thumbnailUrl" | "duration" | "order">>,
): Promise<PlaylistTrack> {
  const order =
    data.order ??
    (await db.playlistTracks.where({ projectId: data.projectId }).count());
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

export async function updatePlaylistTrack(
  id: string,
  data: Partial<
    Pick<
      PlaylistTrack,
      "title" | "url" | "source" | "thumbnailUrl" | "duration"
    >
  >,
): Promise<void> {
  await db.playlistTracks.update(id, { ...data, updatedAt: now() });
}

export async function deletePlaylistTrack(id: string): Promise<void> {
  await db.playlistTracks.delete(id);
}

export async function reorderPlaylistTracks(
  orderedIds: string[],
): Promise<void> {
  return reorderEntities(db.playlistTracks, orderedIds);
}
