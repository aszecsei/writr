import { APP_SETTINGS_ID } from "@/lib/constants";
import { db } from "../database";
import { type AppSettings, AppSettingsSchema } from "../schemas";
import { now } from "./helpers";

// ─── App Settings ───────────────────────────────────────────────────

export async function getAppSettings(): Promise<AppSettings> {
  const existing = await db.appSettings.get(APP_SETTINGS_ID);
  if (existing) return AppSettingsSchema.parse(existing);
  const defaults = AppSettingsSchema.parse({
    id: APP_SETTINGS_ID,
    updatedAt: now(),
  });
  await db.appSettings.add(defaults);
  return defaults;
}

export async function updateAppSettings(
  data: Partial<Omit<AppSettings, "id">>,
): Promise<void> {
  await db.appSettings.update(APP_SETTINGS_ID, {
    ...data,
    updatedAt: now(),
  });
}
