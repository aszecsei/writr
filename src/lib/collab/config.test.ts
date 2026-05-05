import { afterEach, describe, expect, it } from "vitest";
import { getCollabBaseUrl, isCollabEnabled, wsToHttpOrigin } from "./config";

const ORIGINAL = process.env.NEXT_PUBLIC_COLLAB_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_COLLAB_URL;
  else process.env.NEXT_PUBLIC_COLLAB_URL = ORIGINAL;
});

describe("getCollabBaseUrl", () => {
  it("returns null when NEXT_PUBLIC_COLLAB_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_COLLAB_URL;
    expect(getCollabBaseUrl()).toBeNull();
    expect(isCollabEnabled()).toBe(false);
  });

  it("returns null for an empty or whitespace-only value", () => {
    process.env.NEXT_PUBLIC_COLLAB_URL = "";
    expect(getCollabBaseUrl()).toBeNull();
    process.env.NEXT_PUBLIC_COLLAB_URL = "   ";
    expect(getCollabBaseUrl()).toBeNull();
  });

  it("returns null for a non-WebSocket scheme", () => {
    process.env.NEXT_PUBLIC_COLLAB_URL = "https://collab.writr.app";
    expect(getCollabBaseUrl()).toBeNull();
    process.env.NEXT_PUBLIC_COLLAB_URL = "//collab.writr.app";
    expect(getCollabBaseUrl()).toBeNull();
  });

  it("returns the URL trimmed of trailing slashes", () => {
    process.env.NEXT_PUBLIC_COLLAB_URL = "wss://collab.writr.app/";
    expect(getCollabBaseUrl()).toBe("wss://collab.writr.app");
    process.env.NEXT_PUBLIC_COLLAB_URL = "ws://localhost:4444";
    expect(getCollabBaseUrl()).toBe("ws://localhost:4444");
    expect(isCollabEnabled()).toBe(true);
  });
});

describe("wsToHttpOrigin", () => {
  it("rewrites wss:// to https://", () => {
    expect(wsToHttpOrigin("wss://collab.writr.app")).toBe(
      "https://collab.writr.app",
    );
  });

  it("rewrites ws:// to http://", () => {
    expect(wsToHttpOrigin("ws://localhost:4444")).toBe("http://localhost:4444");
  });

  it("leaves already-http URLs unchanged", () => {
    expect(wsToHttpOrigin("https://collab.writr.app")).toBe(
      "https://collab.writr.app",
    );
  });
});
