"use client";

import { db } from "@/db/database";
import { createEntityHook, createProjectListHook } from "./factories";

export const usePlaylistByProject = createProjectListHook(
  db.playlistTracks,
  "order",
);
export const usePlaylistTrack = createEntityHook(db.playlistTracks);
