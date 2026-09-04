"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getActiveSprint } from "@/db/operations";
import type { WritingSprint } from "@/db/schemas";

/** The live `active`/`paused` `WritingSprint` row, or `undefined` if none is running. */
export function useActiveSprint(): WritingSprint | undefined {
  return useLiveQuery(() => getActiveSprint(), []);
}
