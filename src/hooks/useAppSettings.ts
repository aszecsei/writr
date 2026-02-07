"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getAppSettings } from "@/db/operations";

export function useAppSettings() {
  return useLiveQuery(() => getAppSettings());
}
