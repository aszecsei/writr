"use client";

import { db } from "@/db/database";
import {
  createEntityHook,
  createProjectListHook,
  createProjectListUnsortedHook,
} from "../factories";

export const useCharactersByProject = createProjectListHook(
  db.characters,
  "name",
);
export const useCharacter = createEntityHook(db.characters);

export const useLocationsByProject = createProjectListHook(
  db.locations,
  "name",
);
export const useLocation = createEntityHook(db.locations);

export const useTimelineByProject = createProjectListHook(
  db.timelineEvents,
  "order",
);
export const useTimelineEvent = createEntityHook(db.timelineEvents);

export const useStyleGuideByProject = createProjectListHook(
  db.styleGuideEntries,
  "order",
);
export const useStyleGuideEntry = createEntityHook(db.styleGuideEntries);

export const useWorldbuildingDocsByProject = createProjectListHook(
  db.worldbuildingDocs,
  "order",
);
export const useWorldbuildingDoc = createEntityHook(db.worldbuildingDocs);

export const useRelationshipsByProject = createProjectListUnsortedHook(
  db.characterRelationships,
);
