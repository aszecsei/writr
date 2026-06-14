"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { listBrainstormIdeas, listBrainstormSetups } from "@/db/operations";
import type { BrainstormIdea, BrainstormSetup } from "@/db/schemas";
import { createEntityHook } from "../factories";

/** All brainstorm setups, most-recently updated first. */
export function useBrainstormSetups(): BrainstormSetup[] | undefined {
  return useLiveQuery(() => listBrainstormSetups(), []);
}

/** All saved brainstorm ideas, most-recently created first. */
export function useBrainstormIdeas(): BrainstormIdea[] | undefined {
  return useLiveQuery(() => listBrainstormIdeas(), []);
}

export const useBrainstormSetup = createEntityHook(db.brainstormSetups);
