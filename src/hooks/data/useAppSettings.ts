"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { type AppSettings, AppSettingsSchema } from "@/db/schemas";
import { APP_SETTINGS_ID } from "@/lib/constants";

export function useAppSettings(): AppSettings | undefined {
  // Parse through the Zod schema so any field added since the row was
  // written gets filled in via .default(). Without this, existing IndexedDB
  // rows are returned as-is and consumers see `undefined` for new fields.
  return useLiveQuery(async () => {
    const row = await db.appSettings.get(APP_SETTINGS_ID);
    return row ? AppSettingsSchema.parse(row) : undefined;
  }, []);
}
