import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOSE_CODES, type ServerMessage } from "./protocol.js";
import { Room, type SocketLike } from "./room.js";

class MockSocket implements SocketLike {
  sent: ServerMessage[] = [];
  closed: { code: number; reason?: string } | null = null;

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ServerMessage);
  }
  close(code: number, reason?: string): void {
    if (!this.closed)
      this.closed = reason !== undefined ? { code, reason } : { code };
  }

  systemEvents(): Array<{ event: string; [k: string]: unknown }> {
    return this.sent
      .filter(
        (m): m is Extract<ServerMessage, { type: "system" }> =>
          m.type === "system",
      )
      .map((m) => m.data);
  }

  byType<T extends ServerMessage["type"]>(
    type: T,
  ): Array<Extract<ServerMessage, { type: T }>> {
    return this.sent.filter(
      (m): m is Extract<ServerMessage, { type: T }> => m.type === type,
    );
  }
}

function makeRoom(opts?: Partial<ConstructorParameters<typeof Room>[0]>) {
  const inviteTokens =
    opts?.inviteTokens ??
    new Map<string, "view" | "review" | "edit">([
      ["edit-tok", "edit"],
      ["review-tok", "review"],
      ["view-tok", "view"],
    ]);
  return new Room({
    uuid: "room-1",
    hostToken: "host-tok",
    inviteTokens,
    gracePeriodMs: 60_000,
    idleTimeoutMs: 30 * 60_000,
    ...opts,
  });
}

let nextRequestId = 1;

/**
 * Attach a guest the way the host-approval handshake demands: connect,
 * send join-request, host approves. Most existing tests don't care about
 * the handshake specifically, so this keeps them concise. Tests for
 * pending-state behavior should call `attachPending` instead.
 *
 * Requires a host already attached on the same room (passed via `host`).
 */
function attach(
  room: Room,
  token: string,
  host?: { socket: MockSocket; peerId: string },
): { socket: MockSocket; peerId: string } {
  const role = room.authorize(token);
  if (!role) throw new Error(`No role for token ${token}`);
  const socket = new MockSocket();
  const result = room.attach(socket, role);
  if (!result.ok) throw new Error(`Attach failed: ${result.error}`);

  if (role === "host") return { socket, peerId: result.peerId };

  // Find the host. Tests often follow the convention "first attach is
  // host"; if no host param was passed, look one up.
  const hostEntry = host ?? findHost(room);
  if (!hostEntry) {
    // No host yet — attempt to deliver join-request anyway (room will
    // store the requestId in pending; tests that explicitly want
    // pending-without-host should use attachPending).
    return { socket, peerId: result.peerId };
  }

  const requestId = `test-req-${nextRequestId++}`;
  room.receive(result.peerId, {
    type: "join-request",
    requestId,
    guestPub: "AQID",
    displayName: "Tester",
    color: "#abcdef",
  });
  room.receive(hostEntry.peerId, {
    type: "join-approved",
    requestId,
    encryptedRoomKey: "AQID",
    to: result.peerId,
  });
  return { socket, peerId: result.peerId };
}

function findHost(room: Room): { socket: MockSocket; peerId: string } | null {
  // Test helper — reaches into private state. We don't care about
  // strict encapsulation here.
  const sockets = (
    room as unknown as {
      sockets: Map<
        string,
        { socket: MockSocket; peerId: string; role: string }
      >;
    }
  ).sockets;
  for (const entry of sockets.values()) {
    if (entry.role === "host") {
      return { socket: entry.socket, peerId: entry.peerId };
    }
  }
  return null;
}

/**
 * Attach a guest WITHOUT running the join-request handshake. Use this
 * when a test specifically exercises pending-state behavior.
 */
function attachPending(
  room: Room,
  token: string,
): { socket: MockSocket; peerId: string } {
  const role = room.authorize(token);
  if (!role) throw new Error(`No role for token ${token}`);
  const socket = new MockSocket();
  const result = room.attach(socket, role);
  if (!result.ok) throw new Error(`Attach failed: ${result.error}`);
  return { socket, peerId: result.peerId };
}

const sampleY = (
  streamId = 1,
): {
  type: "y-update";
  docKind: "prose";
  streamId: number;
  payload: string;
} => ({
  type: "y-update",
  docKind: "prose",
  streamId,
  payload: "AQID",
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Room.authorize", () => {
  it("returns 'host' for the host token", () => {
    const room = makeRoom();
    expect(room.authorize("host-tok")).toBe("host");
  });

  it("returns the assigned role for invite tokens", () => {
    const room = makeRoom();
    expect(room.authorize("edit-tok")).toBe("edit");
    expect(room.authorize("review-tok")).toBe("review");
    expect(room.authorize("view-tok")).toBe("view");
  });

  it("returns null for unknown tokens", () => {
    const room = makeRoom();
    expect(room.authorize("nope")).toBeNull();
  });

  it("returns null after destroy", () => {
    const room = makeRoom();
    room.destroy("shutdown");
    expect(room.authorize("host-tok")).toBeNull();
  });
});

describe("Room.attach", () => {
  it("sends welcome with assigned role and peer id", () => {
    const room = makeRoom();
    const { socket, peerId } = attach(room, "edit-tok");
    const welcome = socket.byType("welcome")[0];
    expect(welcome).toBeDefined();
    expect(welcome?.role).toBe("edit");
    expect(welcome?.peerId).toBe(peerId);
    expect(welcome?.peerCount).toBe(1);
    expect(welcome?.hostPresent).toBe(false);
  });

  it("notifies existing peers of join with peer_joined", () => {
    const room = makeRoom();
    const a = attach(room, "host-tok");
    const b = attach(room, "edit-tok");
    expect(a.socket.systemEvents()).toContainEqual({
      event: "peer_joined",
      peerId: b.peerId,
      role: "edit",
    });
  });

  it("rejects a second host", () => {
    const room = makeRoom();
    attach(room, "host-tok");
    const second = new MockSocket();
    const result = room.attach(second, "host");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("unauthorized");
  });

  it("enforces maxSockets", () => {
    const room = makeRoom({ maxSockets: 2 });
    attach(room, "host-tok");
    attach(room, "edit-tok");
    const third = new MockSocket();
    const result = room.attach(third, "view");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("room-full");
  });

  it("sends buffered updates to late joiners", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    room.receive(host.peerId, sampleY());
    room.receive(host.peerId, { ...sampleY(), payload: "BBBB" });
    const guest = attach(room, "view-tok");
    const buffer = guest.socket.byType("buffer")[0];
    expect(buffer).toBeDefined();
    expect(buffer?.docKind).toBe("prose");
    expect(buffer?.updates).toEqual(["AQID", "BBBB"]);
  });

  it("emits host_connected when host attaches", () => {
    const room = makeRoom();
    const guest = attach(room, "edit-tok");
    attach(room, "host-tok");
    expect(
      guest.socket.systemEvents().some((e) => e.event === "host_connected"),
    ).toBe(true);
  });
});

describe("Room.receive: role gating", () => {
  it("blocks 'view' from sending y-update and closes the socket", () => {
    const room = makeRoom();
    const { socket, peerId } = attach(room, "view-tok");
    room.receive(peerId, sampleY());
    expect(socket.byType("error")[0]?.code).toBe("unauthorized");
    expect(socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
  });

  it("blocks 'review' from sending y-update on prose, allows on comments", () => {
    const room = makeRoom();
    attach(room, "host-tok");
    const guest = attach(room, "review-tok");
    room.receive(guest.peerId, sampleY());
    expect(guest.socket.byType("error")[0]?.code).toBe("unauthorized");
    expect(guest.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);

    const r2 = makeRoom();
    attach(r2, "host-tok");
    const g2 = attach(r2, "review-tok");
    r2.receive(g2.peerId, { ...sampleY(), docKind: "comments" });
    expect(g2.socket.byType("error")).toHaveLength(0);
    expect(g2.socket.closed).toBeNull();
  });

  it("allows 'edit' to send prose y-update", () => {
    const room = makeRoom();
    attach(room, "host-tok");
    const editor = attach(room, "edit-tok");
    room.receive(editor.peerId, sampleY());
    expect(editor.socket.byType("error")).toHaveLength(0);
  });

  it("allows host to send y-update on the project docKind", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    room.receive(host.peerId, { ...sampleY(), docKind: "project" });
    expect(host.socket.byType("error")).toHaveLength(0);
    expect(host.socket.closed).toBeNull();
  });

  it("blocks non-host roles from sending project y-update", () => {
    for (const token of ["edit-tok", "review-tok", "view-tok"] as const) {
      const room = makeRoom();
      attach(room, "host-tok");
      const guest = attach(room, token);
      room.receive(guest.peerId, { ...sampleY(), docKind: "project" });
      expect(guest.socket.byType("error")[0]?.code).toBe("unauthorized");
      expect(guest.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
    }
  });

  it("buffers project updates and replays them to a newly-attached view guest", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    room.receive(host.peerId, { ...sampleY(), docKind: "project" });
    room.receive(host.peerId, {
      ...sampleY(),
      docKind: "project",
      payload: "BBBB",
    });
    const guest = attach(room, "view-tok");
    const projectBuffer = guest.socket
      .byType("buffer")
      .find((b) => b.docKind === "project");
    expect(projectBuffer).toBeDefined();
    expect(projectBuffer?.updates).toEqual(["AQID", "BBBB"]);
  });
});

describe("Room.receive: relay", () => {
  it("relays y-update to other peers, not the sender", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const editor = attach(room, "edit-tok");
    host.socket.sent = [];
    editor.socket.sent = [];

    room.receive(editor.peerId, sampleY());

    expect(host.socket.byType("y-update")[0]?.payload).toBe("AQID");
    expect(host.socket.byType("y-update")[0]?.from).toBe(editor.peerId);
    expect(editor.socket.byType("y-update")).toHaveLength(0);
  });

  it("relays awareness to other peers, not the sender", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const guest = attach(room, "view-tok");
    host.socket.sent = [];
    guest.socket.sent = [];

    room.receive(guest.peerId, { type: "awareness", payload: "AQID" });

    expect(host.socket.byType("awareness")[0]?.payload).toBe("AQID");
    expect(guest.socket.byType("awareness")).toHaveLength(0);
  });
});

describe("Room: invalid messages", () => {
  it("closes socket on malformed message", () => {
    const room = makeRoom();
    const { socket, peerId } = attach(room, "edit-tok");
    room.receive(peerId, { type: "y-update", docKind: "prose" });
    expect(socket.byType("error")[0]?.code).toBe("invalid-message");
    expect(socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
  });

  it("rejects non-base64 payloads", () => {
    const room = makeRoom();
    const { socket, peerId } = attach(room, "edit-tok");
    room.receive(peerId, {
      type: "y-update",
      docKind: "prose",
      streamId: 1,
      payload: "not base64!!!",
    });
    expect(socket.byType("error")[0]?.code).toBe("invalid-message");
  });
});

describe("Room: host disconnect grace", () => {
  it("emits host_disconnected with deadline when host detaches", () => {
    const room = makeRoom({ gracePeriodMs: 5_000 });
    const host = attach(room, "host-tok");
    const guest = attach(room, "edit-tok");
    guest.socket.sent = [];

    room.detach(host.peerId);

    const disconnected = guest.socket
      .systemEvents()
      .find((e) => e.event === "host_disconnected");
    expect(disconnected).toBeDefined();
    expect(typeof disconnected?.deadline).toBe("number");
  });

  it("destroys the room when grace expires without reconnect", () => {
    const room = makeRoom({ gracePeriodMs: 5_000 });
    const host = attach(room, "host-tok");
    const guest = attach(room, "edit-tok");

    room.detach(host.peerId);
    expect(room.isDestroyed).toBe(false);

    vi.advanceTimersByTime(5_000);

    expect(room.isDestroyed).toBe(true);
    expect(
      guest.socket.systemEvents().some((e) => e.event === "session_ended"),
    ).toBe(true);
    expect(guest.socket.closed?.code).toBe(CLOSE_CODES.SESSION_ENDED);
  });

  it("cancels grace and emits host_connected when host reconnects in time", () => {
    const room = makeRoom({ gracePeriodMs: 5_000 });
    const host = attach(room, "host-tok");
    const guest = attach(room, "edit-tok");

    room.detach(host.peerId);
    vi.advanceTimersByTime(2_000);

    const reconnect = attach(room, "host-tok");
    vi.advanceTimersByTime(10_000);

    expect(room.isDestroyed).toBe(false);
    expect(
      guest.socket.systemEvents().some((e) => e.event === "host_connected"),
    ).toBe(true);
    expect(reconnect.peerId).toBeTruthy();
  });

  it("destroys immediately when host detaches with no other peers", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    room.detach(host.peerId);
    expect(room.isDestroyed).toBe(true);
  });
});

describe("Room: idle timeout", () => {
  it("destroys the room after idleTimeoutMs of no activity", () => {
    const room = makeRoom({ idleTimeoutMs: 1_000 });
    const { socket } = attach(room, "host-tok");
    vi.advanceTimersByTime(2_000);
    expect(room.isDestroyed).toBe(true);
    expect(socket.systemEvents().some((e) => e.event === "session_ended")).toBe(
      true,
    );
  });

  it("resets idle timer on receive", () => {
    const room = makeRoom({ idleTimeoutMs: 1_000 });
    const host = attach(room, "host-tok");
    vi.advanceTimersByTime(800);
    room.receive(host.peerId, { type: "awareness", payload: "AQID" });
    vi.advanceTimersByTime(800);
    expect(room.isDestroyed).toBe(false);
    vi.advanceTimersByTime(400);
    expect(room.isDestroyed).toBe(true);
  });
});

describe("Room: buffer cap", () => {
  it("evicts oldest updates beyond maxBufferBytes", () => {
    const room = makeRoom({ maxBufferBytes: 16 });
    const host = attach(room, "host-tok");
    room.receive(host.peerId, { ...sampleY(), payload: "AAAAAAAA" });
    room.receive(host.peerId, { ...sampleY(), payload: "BBBBBBBB" });
    room.receive(host.peerId, { ...sampleY(), payload: "CCCCCCCC" });
    const late = attach(room, "view-tok");
    const buffer = late.socket.byType("buffer")[0];
    expect(buffer).toBeDefined();
    expect(buffer?.updates).not.toContain("AAAAAAAA");
    expect(buffer?.updates).toContain("CCCCCCCC");
  });
});

describe("Room.destroy", () => {
  it("calls onDestroy with the room uuid", () => {
    const onDestroy = vi.fn();
    const room = makeRoom({ onDestroy });
    room.destroy("shutdown");
    expect(onDestroy).toHaveBeenCalledWith("room-1");
  });

  it("is idempotent", () => {
    const onDestroy = vi.fn();
    const room = makeRoom({ onDestroy });
    room.destroy("shutdown");
    room.destroy("shutdown");
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });
});

describe("Room: handshake (pending guests)", () => {
  it("sends welcome to a pending guest but no buffer and no peer_joined to others", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    room.receive(host.peerId, sampleY());
    host.socket.sent = [];

    const guest = attachPending(room, "edit-tok");
    expect(guest.socket.byType("welcome")).toHaveLength(1);
    expect(guest.socket.byType("buffer")).toHaveLength(0);
    // Host should NOT see peer_joined for a pending guest.
    expect(
      host.socket.systemEvents().some((e) => e.event === "peer_joined"),
    ).toBe(false);
  });

  it("forwards join-request to host with 'from' tagged to the guest's peerId", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    host.socket.sent = [];

    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-1",
      guestPub: "AQID",
      displayName: "Alice",
      color: "#abcdef",
    });

    const fwd = host.socket.byType("join-request")[0];
    expect(fwd).toBeDefined();
    expect(fwd?.from).toBe(guest.peerId);
    expect(fwd?.displayName).toBe("Alice");
    expect(fwd?.requestId).toBe("req-1");
  });

  it("approve forwards join-approved to the target, sends buffer, and broadcasts peer_joined", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    room.receive(host.peerId, sampleY());
    const observer = attach(room, "view-tok");
    observer.socket.sent = [];
    host.socket.sent = [];

    const guest = attachPending(room, "edit-tok");
    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-A",
      guestPub: "AQID",
      displayName: "Alice",
      color: "#abcdef",
    });
    guest.socket.sent = [];

    room.receive(host.peerId, {
      type: "join-approved",
      requestId: "req-A",
      encryptedRoomKey: "BBBB",
      to: guest.peerId,
    });

    const approved = guest.socket.byType("join-approved")[0];
    expect(approved?.requestId).toBe("req-A");
    expect(approved?.encryptedRoomKey).toBe("BBBB");

    const buffer = guest.socket.byType("buffer")[0];
    expect(buffer?.updates).toEqual(["AQID"]);

    const observerJoinEvents = observer.socket
      .systemEvents()
      .filter((e) => e.event === "peer_joined");
    expect(observerJoinEvents.some((e) => e.peerId === guest.peerId)).toBe(
      true,
    );
  });

  it("approved guest can now send awareness and is relayed to others", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-1",
      guestPub: "AQID",
      displayName: "Alice",
      color: "#abcdef",
    });
    room.receive(host.peerId, {
      type: "join-approved",
      requestId: "req-1",
      encryptedRoomKey: "BBBB",
      to: guest.peerId,
    });
    host.socket.sent = [];

    room.receive(guest.peerId, { type: "awareness", payload: "AQID" });

    expect(host.socket.byType("awareness")[0]?.payload).toBe("AQID");
    expect(host.socket.byType("awareness")[0]?.from).toBe(guest.peerId);
  });

  it("rejects doc traffic from a pending guest with join-rejected and closes", () => {
    const room = makeRoom();
    attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");

    room.receive(guest.peerId, sampleY());

    expect(guest.socket.byType("error")[0]?.code).toBe("join-rejected");
    expect(guest.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
  });

  it("deny forwards join-denied to the target then closes the guest", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-D",
      guestPub: "AQID",
      displayName: "Bob",
      color: "#aabbcc",
    });
    guest.socket.sent = [];
    host.socket.sent = [];

    room.receive(host.peerId, {
      type: "join-denied",
      requestId: "req-D",
      reason: "no thanks",
      to: guest.peerId,
    });

    const denied = guest.socket.byType("join-denied")[0];
    expect(denied?.requestId).toBe("req-D");
    expect(denied?.reason).toBe("no thanks");
    expect(guest.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
    // Host should NOT receive a stale join_request_cancelled after their
    // own denial.
    expect(
      host.socket
        .systemEvents()
        .some((e) => e.event === "join_request_cancelled"),
    ).toBe(false);
  });

  it("emits join_request_cancelled to host when a pending guest disconnects mid-request", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-X",
      guestPub: "AQID",
      displayName: "Carol",
      color: "#001122",
    });
    host.socket.sent = [];

    room.detach(guest.peerId);

    const cancelled = host.socket
      .systemEvents()
      .find((e) => e.event === "join_request_cancelled");
    expect(cancelled).toBeDefined();
    expect(cancelled?.requestId).toBe("req-X");
  });

  it("does not emit join_request_cancelled if pending guest disconnects before sending join-request", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    host.socket.sent = [];

    room.detach(guest.peerId);

    expect(
      host.socket
        .systemEvents()
        .some((e) => e.event === "join_request_cancelled"),
    ).toBe(false);
  });

  it("rejects join-approved from a non-host with unauthorized", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const guestA = attach(room, "edit-tok", host);
    const guestB = attachPending(room, "view-tok");
    room.receive(guestB.peerId, {
      type: "join-request",
      requestId: "req-1",
      guestPub: "AQID",
      displayName: "B",
      color: "#abcdef",
    });

    // guestA (admitted, role=edit) tries to approve guestB.
    room.receive(guestA.peerId, {
      type: "join-approved",
      requestId: "req-1",
      encryptedRoomKey: "BBBB",
      to: guestB.peerId,
    });

    expect(guestA.socket.byType("error")[0]?.code).toBe("unauthorized");
    expect(guestA.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
    // B should NOT have received join-approved.
    expect(guestB.socket.byType("join-approved")).toHaveLength(0);
  });

  it("rejects join-approved with a mismatched requestId", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-real",
      guestPub: "AQID",
      displayName: "x",
      color: "#abcdef",
    });
    host.socket.sent = [];

    room.receive(host.peerId, {
      type: "join-approved",
      requestId: "req-bogus",
      encryptedRoomKey: "BBBB",
      to: guest.peerId,
    });

    expect(host.socket.byType("error")[0]?.code).toBe("join-rejected");
    expect(guest.socket.byType("join-approved")).toHaveLength(0);
  });

  it("welcome's peerCount excludes pending guests so admitted peers see consistent counts", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    // Host attached: peerCount in welcome should be 1.
    expect(host.socket.byType("welcome")[0]?.peerCount).toBe(1);

    const pending = attachPending(room, "edit-tok");
    // Pending guest sees themselves + admitted host = 2.
    expect(pending.socket.byType("welcome")[0]?.peerCount).toBe(2);
  });
});

describe("Room: pending join timeout", () => {
  it("times out a pending guest after joinTimeoutMs and notifies the host", () => {
    const room = makeRoom({ joinTimeoutMs: 5_000 });
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-T",
      guestPub: "AQID",
      displayName: "T",
      color: "#abcdef",
    });
    host.socket.sent = [];
    guest.socket.sent = [];

    vi.advanceTimersByTime(5_000);

    // Guest gets a join-timeout error and is closed.
    expect(guest.socket.byType("error")[0]?.code).toBe("join-timeout");
    expect(guest.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
    // Host gets join_request_cancelled so the modal clears.
    const cancelled = host.socket
      .systemEvents()
      .find((e) => e.event === "join_request_cancelled");
    expect(cancelled?.requestId).toBe("req-T");
  });

  it("times out a pending guest who never sent join-request without notifying host", () => {
    const room = makeRoom({ joinTimeoutMs: 5_000 });
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    host.socket.sent = [];

    vi.advanceTimersByTime(5_000);

    expect(guest.socket.byType("error")[0]?.code).toBe("join-timeout");
    expect(guest.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
    expect(
      host.socket
        .systemEvents()
        .some((e) => e.event === "join_request_cancelled"),
    ).toBe(false);
  });

  it("cancels the timeout when the host approves in time", () => {
    const room = makeRoom({ joinTimeoutMs: 5_000 });
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-OK",
      guestPub: "AQID",
      displayName: "OK",
      color: "#abcdef",
    });
    room.receive(host.peerId, {
      type: "join-approved",
      requestId: "req-OK",
      encryptedRoomKey: "BBBB",
      to: guest.peerId,
    });

    guest.socket.sent = [];
    vi.advanceTimersByTime(10_000);

    // No timeout error fires after approval.
    expect(guest.socket.byType("error")).toHaveLength(0);
    expect(guest.socket.closed).toBeNull();
  });

  it("cancels the timeout when the host denies", () => {
    const room = makeRoom({ joinTimeoutMs: 5_000 });
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-N",
      guestPub: "AQID",
      displayName: "N",
      color: "#abcdef",
    });
    room.receive(host.peerId, {
      type: "join-denied",
      requestId: "req-N",
      to: guest.peerId,
    });

    // Already closed; advancing time should not produce a second error.
    const errorsAfterDeny = guest.socket.byType("error").length;
    vi.advanceTimersByTime(10_000);
    expect(guest.socket.byType("error").length).toBe(errorsAfterDeny);
  });

  it("cancels the timeout when the pending guest disconnects on their own", () => {
    const room = makeRoom({ joinTimeoutMs: 5_000 });
    const host = attach(room, "host-tok");
    const guest = attachPending(room, "edit-tok");
    room.receive(guest.peerId, {
      type: "join-request",
      requestId: "req-D",
      guestPub: "AQID",
      displayName: "D",
      color: "#abcdef",
    });

    room.detach(guest.peerId);

    const cancelledBefore = host.socket
      .systemEvents()
      .filter((e) => e.event === "join_request_cancelled").length;
    vi.advanceTimersByTime(10_000);
    const cancelledAfter = host.socket
      .systemEvents()
      .filter((e) => e.event === "join_request_cancelled").length;
    // Only one cancelled event — the one from detach. Timeout should
    // have been cleared.
    expect(cancelledAfter).toBe(cancelledBefore);
  });
});

describe("Room: kick-peer", () => {
  it("kicks an admitted guest, broadcasting peer_left", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const guest = attach(room, "edit-tok", host);
    const observer = attach(room, "view-tok", host);
    host.socket.sent = [];
    observer.socket.sent = [];

    room.receive(host.peerId, {
      type: "kick-peer",
      peerId: guest.peerId,
    });

    expect(guest.socket.byType("error")[0]?.code).toBe("unauthorized");
    expect(guest.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
    expect(guest.socket.closed?.reason).toBe("kicked");
    const peerLeft = observer.socket
      .systemEvents()
      .find((e) => e.event === "peer_left");
    expect(peerLeft?.peerId).toBe(guest.peerId);
  });

  it("rejects kick-peer from a non-host with unauthorized", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const a = attach(room, "edit-tok", host);
    const b = attach(room, "view-tok", host);

    room.receive(a.peerId, {
      type: "kick-peer",
      peerId: b.peerId,
    });

    expect(a.socket.byType("error")[0]?.code).toBe("unauthorized");
    expect(a.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);
    expect(b.socket.closed).toBeNull();
  });

  it("returns an error if the target peerId is unknown", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    host.socket.sent = [];

    room.receive(host.peerId, {
      type: "kick-peer",
      peerId: "nonexistent",
    });

    expect(host.socket.byType("error")[0]?.code).toBe("unauthorized");
    expect(host.socket.byType("error")[0]?.message).toMatch(/not found/i);
  });

  it("ignores a host trying to kick themselves", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    host.socket.sent = [];

    room.receive(host.peerId, {
      type: "kick-peer",
      peerId: host.peerId,
    });

    expect(host.socket.closed).toBeNull();
  });
});
