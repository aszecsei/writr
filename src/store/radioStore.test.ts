import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { getAppSettings } from "@/db/operations";
import { useRadioStore } from "./radioStore";

beforeEach(async () => {
  await db.appSettings.clear();
  useRadioStore.setState({
    volume: 80,
    muted: false,
    shuffleEnabled: false,
    loopMode: "off",
  });
});

describe("radioStore", () => {
  it("writes volume changes through to AppSettings.radio", async () => {
    useRadioStore.getState().setVolume(42);

    expect(useRadioStore.getState().volume).toBe(42);
    await vi.waitFor(async () => {
      const settings = await getAppSettings();
      expect(settings.radio.volume).toBe(42);
    });
  });

  it("writes mute toggles through to AppSettings.radio", async () => {
    useRadioStore.getState().toggleMute();

    expect(useRadioStore.getState().muted).toBe(true);
    await vi.waitFor(async () => {
      const settings = await getAppSettings();
      expect(settings.radio.muted).toBe(true);
    });
  });

  it("writes loop mode changes through to AppSettings.radio", async () => {
    useRadioStore.getState().cycleLoopMode();

    expect(useRadioStore.getState().loopMode).toBe("all");
    await vi.waitFor(async () => {
      const settings = await getAppSettings();
      expect(settings.radio.loopMode).toBe("all");
    });
  });

  it("hydrates volume/muted/shuffleEnabled/loopMode from AppSettings", () => {
    useRadioStore.getState().hydrateFromSettings({
      volume: 55,
      muted: true,
      shuffleEnabled: true,
      loopMode: "one",
    });

    const state = useRadioStore.getState();
    expect(state.volume).toBe(55);
    expect(state.muted).toBe(true);
    expect(state.shuffleEnabled).toBe(true);
    expect(state.loopMode).toBe("one");
  });
});
