"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { APP_SETTINGS_ID } from "@/lib/constants";

export function useAppSettings() {
  return useLiveQuery(() => db.appSettings.get(APP_SETTINGS_ID));
}
