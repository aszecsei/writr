"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";

export function usePlaylistByProject(projectId: string | null) {
  return useLiveQuery(
    () =>
      projectId ? db.playlistTracks.where({ projectId }).sortBy("order") : [],
    [projectId],
  );
}

export function usePlaylistTrack(id: string | null) {
  return useLiveQuery(() => (id ? db.playlistTracks.get(id) : undefined), [id]);
}
