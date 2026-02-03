"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { AppSettingsSchema } from "@/db/schemas";
import { APP_SETTINGS_ID } from "@/lib/constants";

export function useAppSettings() {
  return useLiveQuery(async () => {
    const raw = await db.appSettings.get(APP_SETTINGS_ID);
    if (!raw) return undefined;
    return AppSettingsSchema.parse(raw);
  });
}
