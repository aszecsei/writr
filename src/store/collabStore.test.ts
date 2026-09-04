import { beforeEach, describe, expect, it } from "vitest";
import type { ShareUrls } from "@/lib/collab/lifecycle";
import type { CollabSession } from "@/lib/collab/session";
import { collabSelectors, useCollabStore } from "./collabStore";

const fakeSession = {} as CollabSession;
const fakeShareUrls: ShareUrls = {
  mode: "chapter",
  edit: "https://writr.app/shared/r1?t=e#h=h",
  review: "https://writr.app/shared/r1?t=r#h=h",
  view: "https://writr.app/shared/r1?t=v#h=h",
};

function getState() {
  return useCollabStore.getState();
}

describe("collabStore", () => {
  beforeEach(() => {
    getState().reset();
  });

  it("starts in the idle state with no session", () => {
    const s = getState();
    expect(s.status).toBe("idle");
    expect(s.session).toBeNull();
    expect(s.role).toBeNull();
    expect(s.peerId).toBeNull();
    expect(s.peerCount).toBe(0);
    expect(s.hostPresent).toBe(false);
    expect(s.hostGraceDeadline).toBeNull();
    expect(s.shareUrls).toBeNull();
    expect(s.error).toBeNull();
  });

  it("setSession populates role/peer info, transitions to connected, and clears errors", () => {
    getState().setError({ kind: "transport", message: "earlier failure" });
    getState().setSession(fakeSession, {
      role: "edit",
      peerId: "peer-1",
      hostPresent: true,
    });
    const s = getState();
    expect(s.session).toBe(fakeSession);
    expect(s.role).toBe("edit");
    expect(s.peerId).toBe("peer-1");
    expect(s.hostPresent).toBe(true);
    expect(s.status).toBe("connected");
    expect(s.error).toBeNull();
  });

  it("reset clears all fields back to the initial state", () => {
    getState().setSession(fakeSession, {
      role: "host",
      peerId: "p",
      hostPresent: true,
    });
    getState().setShareUrls(fakeShareUrls);
    getState().setPeerCount(5);
    getState().setHostGraceDeadline(999);
    getState().setError({ kind: "transport", message: "x" });
    getState().reset();
    const s = getState();
    expect(s.session).toBeNull();
    expect(s.status).toBe("idle");
    expect(s.role).toBeNull();
    expect(s.peerId).toBeNull();
    expect(s.peerCount).toBe(0);
    expect(s.hostPresent).toBe(false);
    expect(s.hostGraceDeadline).toBeNull();
    expect(s.shareUrls).toBeNull();
    expect(s.error).toBeNull();
  });
});

describe("collabSelectors", () => {
  beforeEach(() => {
    getState().reset();
  });

  it.each([
    ["host", "isHost", true],
    ["host", "canEditComments", true],
    ["edit", "isHost", false],
    ["edit", "canEditComments", true],
    ["review", "isHost", false],
    ["review", "canEditComments", true],
    ["view", "isHost", false],
    ["view", "canEditComments", false],
  ] as const)("role=%s: %s -> %s", (role, selectorName, expected) => {
    getState().setSession(fakeSession, {
      role,
      peerId: "p",
      hostPresent: true,
    });
    expect(collabSelectors[selectorName](getState())).toBe(expected);
  });

  it("isInGrace only when status is host_disconnected", () => {
    expect(collabSelectors.isInGrace(getState())).toBe(false);
    getState().setStatus("host_disconnected");
    expect(collabSelectors.isInGrace(getState())).toBe(true);
    getState().setStatus("connected");
    expect(collabSelectors.isInGrace(getState())).toBe(false);
  });
});
