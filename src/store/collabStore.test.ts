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

  it("setStatus transitions through host_disconnected and back", () => {
    getState().setSession(fakeSession, {
      role: "edit",
      peerId: "p",
      hostPresent: true,
    });
    getState().setStatus("host_disconnected");
    expect(getState().status).toBe("host_disconnected");
    getState().setStatus("connected");
    expect(getState().status).toBe("connected");
  });

  it("setPeerCount, setHostPresent, setHostGraceDeadline update individually", () => {
    getState().setPeerCount(3);
    expect(getState().peerCount).toBe(3);
    getState().setHostPresent(false);
    expect(getState().hostPresent).toBe(false);
    getState().setHostGraceDeadline(123_456);
    expect(getState().hostGraceDeadline).toBe(123_456);
    getState().setHostGraceDeadline(null);
    expect(getState().hostGraceDeadline).toBeNull();
  });

  it("setShareUrls only stores values (intended for host)", () => {
    getState().setShareUrls(fakeShareUrls);
    expect(getState().shareUrls).toEqual(fakeShareUrls);
    getState().setShareUrls(null);
    expect(getState().shareUrls).toBeNull();
  });

  it("setError records and clears terminal errors", () => {
    getState().setError({ kind: "room-not-found", message: "no such room" });
    expect(getState().error?.kind).toBe("room-not-found");
    getState().setError(null);
    expect(getState().error).toBeNull();
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

  it("isHost only when role is host", () => {
    getState().setSession(fakeSession, {
      role: "edit",
      peerId: "p",
      hostPresent: true,
    });
    expect(collabSelectors.isHost(getState())).toBe(false);
    getState().setSession(fakeSession, {
      role: "host",
      peerId: "p",
      hostPresent: true,
    });
    expect(collabSelectors.isHost(getState())).toBe(true);
  });

  it("canEditComments: host, edit, or review", () => {
    for (const role of ["host", "edit", "review"] as const) {
      getState().setSession(fakeSession, {
        role,
        peerId: "p",
        hostPresent: true,
      });
      expect(collabSelectors.canEditComments(getState())).toBe(true);
    }
    getState().setSession(fakeSession, {
      role: "view",
      peerId: "p",
      hostPresent: true,
    });
    expect(collabSelectors.canEditComments(getState())).toBe(false);
  });

  it("isInGrace only when status is host_disconnected", () => {
    expect(collabSelectors.isInGrace(getState())).toBe(false);
    getState().setStatus("host_disconnected");
    expect(collabSelectors.isInGrace(getState())).toBe(true);
    getState().setStatus("connected");
    expect(collabSelectors.isInGrace(getState())).toBe(false);
  });
});
