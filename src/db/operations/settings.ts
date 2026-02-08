import { APP_SETTINGS_ID } from "@/lib/constants";
import { db } from "../database";
import { type AppSettings, AppSettingsSchema } from "../schemas";
import { now } from "./helpers";

// ─── App Settings ───────────────────────────────────────────────────

export async function getAppSettings(): Promise<AppSettings> {
  const existing = await db.appSettings.get(APP_SETTINGS_ID);
  if (existing) return AppSettingsSchema.parse(existing);
  // Row should exist via on('ready') seed; return in-memory defaults as fallback
  return AppSettingsSchema.parse({
    id: APP_SETTINGS_ID,
    updatedAt: now(),
  });
}

export async function updateAppSettings(
  data: Partial<Omit<AppSettings, "id">>,
): Promise<void> {
  const timestamp = now();
  const existing = await db.appSettings.get(APP_SETTINGS_ID);
  if (existing) {
    await db.appSettings.put({ ...existing, ...data, updatedAt: timestamp });
  } else {
    await db.appSettings.add(
      AppSettingsSchema.parse({
        id: APP_SETTINGS_ID,
        ...data,
        updatedAt: timestamp,
      }),
    );
  }
}
