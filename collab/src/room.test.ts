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

function attach(
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
    const guest = attach(room, "review-tok");
    room.receive(guest.peerId, sampleY());
    expect(guest.socket.byType("error")[0]?.code).toBe("unauthorized");
    expect(guest.socket.closed?.code).toBe(CLOSE_CODES.FORBIDDEN);

    const r2 = makeRoom();
    const g2 = attach(r2, "review-tok");
    r2.receive(g2.peerId, { ...sampleY(), docKind: "comments" });
    expect(g2.socket.byType("error")).toHaveLength(0);
    expect(g2.socket.closed).toBeNull();
  });

  it("allows 'edit' to send prose y-update", () => {
    const room = makeRoom();
    const editor = attach(room, "edit-tok");
    room.receive(editor.peerId, sampleY());
    expect(editor.socket.byType("error")).toHaveLength(0);
  });

  it("blocks non-host from sending meta", () => {
    const room = makeRoom();
    const editor = attach(room, "edit-tok");
    room.receive(editor.peerId, {
      type: "meta",
      streamId: 1,
      payload: "AQID",
    });
    expect(editor.socket.byType("error")[0]?.code).toBe("unauthorized");
  });

  it("allows host to send rotate-stream", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    room.receive(host.peerId, {
      type: "rotate-stream",
      docKind: "prose",
      newStreamId: 2,
    });
    expect(host.socket.byType("error")).toHaveLength(0);
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

  it("drops y-update with stale streamId", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const editor = attach(room, "edit-tok");
    room.receive(host.peerId, {
      type: "rotate-stream",
      docKind: "prose",
      newStreamId: 5,
    });
    host.socket.sent = [];

    room.receive(editor.peerId, sampleY(1));
    expect(host.socket.byType("y-update")).toHaveLength(0);

    room.receive(editor.peerId, sampleY(5));
    expect(host.socket.byType("y-update")).toHaveLength(1);
  });
});

describe("Room.receive: rotate-stream", () => {
  it("clears buffer and broadcasts to all peers including host", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    const editor = attach(room, "edit-tok");
    room.receive(editor.peerId, sampleY(1));
    host.socket.sent = [];
    editor.socket.sent = [];

    room.receive(host.peerId, {
      type: "rotate-stream",
      docKind: "prose",
      newStreamId: 2,
    });

    expect(host.socket.byType("rotate-stream")[0]?.newStreamId).toBe(2);
    expect(editor.socket.byType("rotate-stream")[0]?.newStreamId).toBe(2);

    const lateGuest = attach(room, "view-tok");
    expect(lateGuest.socket.byType("buffer")).toHaveLength(0);
  });

  it("ignores rotate-stream with a non-increasing streamId", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    room.receive(host.peerId, {
      type: "rotate-stream",
      docKind: "prose",
      newStreamId: 2,
    });
    host.socket.sent = [];

    room.receive(host.peerId, {
      type: "rotate-stream",
      docKind: "prose",
      newStreamId: 2,
    });
    expect(host.socket.byType("rotate-stream")).toHaveLength(0);

    room.receive(host.peerId, {
      type: "rotate-stream",
      docKind: "prose",
      newStreamId: 1,
    });
    expect(host.socket.byType("rotate-stream")).toHaveLength(0);
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

describe("Room.receive: request-buffer", () => {
  it("sends current buffer for a docKind on request", () => {
    const room = makeRoom();
    const host = attach(room, "host-tok");
    room.receive(host.peerId, sampleY());
    const guest = attach(room, "view-tok");
    guest.socket.sent = [];

    room.receive(guest.peerId, { type: "request-buffer", docKind: "prose" });

    const buffer = guest.socket.byType("buffer")[0];
    expect(buffer?.updates).toEqual(["AQID"]);
    expect(buffer?.streamId).toBe(1);
  });
});
