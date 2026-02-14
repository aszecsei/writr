"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { AppSettings } from "@/db/schemas";
import { APP_SETTINGS_ID } from "@/lib/constants";

export function useAppSettings(): AppSettings | undefined {
  return useLiveQuery(() => db.appSettings.get(APP_SETTINGS_ID), []);
}
