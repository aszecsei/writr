import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import { getAppSettings, updateAppSettings } from "./settings";

beforeEach(async () => {
  await db.appSettings.clear();
});

describe("app settings", () => {
  it("defaults the radio preferences", async () => {
    const settings = await getAppSettings();

    expect(settings.radio).toEqual({
      volume: 80,
      muted: false,
      shuffleEnabled: false,
      loopMode: "off",
    });
  });

  it("persists radio preferences across reads", async () => {
    await updateAppSettings({
      radio: { volume: 42, muted: true, shuffleEnabled: true, loopMode: "one" },
    });

    const settings = await getAppSettings();
    expect(settings.radio).toEqual({
      volume: 42,
      muted: true,
      shuffleEnabled: true,
      loopMode: "one",
    });
  });

  it("fills in radio preferences for a row written before that field existed", async () => {
    await db.appSettings.add({
      id: "app-settings",
      updatedAt: new Date().toISOString(),
    } as never);

    const settings = await getAppSettings();
    expect(settings.radio).toEqual({
      volume: 80,
      muted: false,
      shuffleEnabled: false,
      loopMode: "off",
    });
  });
});
