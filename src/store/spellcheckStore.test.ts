import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { getAppSettings } from "@/db/operations";
import { useSpellcheckStore } from "./spellcheckStore";

beforeEach(async () => {
  await db.appSettings.clear();
  useSpellcheckStore.setState({ enabled: true });
});

describe("spellcheckStore", () => {
  it("writes toggleEnabled through to AppSettings.spellcheckEnabled", async () => {
    useSpellcheckStore.getState().toggleEnabled();

    expect(useSpellcheckStore.getState().enabled).toBe(false);
    await vi.waitFor(async () => {
      const settings = await getAppSettings();
      expect(settings.spellcheckEnabled).toBe(false);
    });
  });

  it("setEnabled mirrors a persisted value into local state", () => {
    useSpellcheckStore.getState().setEnabled(false);
    expect(useSpellcheckStore.getState().enabled).toBe(false);
  });
});
