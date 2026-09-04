import { beforeEach, describe, expect, it } from "vitest";
import { useCollabStore } from "@/store/collabStore";
import { attachClientToStore } from "./attach";
import { CollabClient, type CollabTransport } from "./client";
import { generateRoomKey, type RoomKey } from "./crypto";
import { CLOSE_CODES, type ServerMessage } from "./protocol";

class MockTransport implements CollabTransport {
  send(_data: string): void {}
  close(_code?: number, _reason?: string): void {}
}

async function makeClient(): Promise<{ client: CollabClient; key: RoomKey }> {
  const key = await generateRoomKey();
  const client = new CollabClient({
    transport: new MockTransport(),
    key,
    role: "edit",
  });
  return { client, key };
}

async function deliver(
  client: CollabClient,
  message: ServerMessage,
): Promise<void> {
  await client.handleMessage(JSON.stringify(message));
}

function getState() {
  return useCollabStore.getState();
}

beforeEach(() => {
  useCollabStore.getState().reset();
  // Seed the store as the orchestration layer would after welcome.
  useCollabStore.getState().setPeerCount(1);
  useCollabStore.getState().setHostPresent(true);
  useCollabStore.getState().setStatus("connected");
});

describe("attachClientToStore: peer counting", () => {
  it("increments peerCount on peer_joined", async () => {
    const { client } = await makeClient();
    attachClientToStore(client, useCollabStore);
    await deliver(client, {
      type: "system",
      data: { event: "peer_joined", peerId: "p2", role: "view" },
    });
    expect(getState().peerCount).toBe(2);
  });

  it("decrements peerCount on peer_left, floored at 0", async () => {
    const { client } = await makeClient();
    attachClientToStore(client, useCollabStore);
    await deliver(client, {
      type: "system",
      data: { event: "peer_left", peerId: "p2" },
    });
    expect(getState().peerCount).toBe(0);
    await deliver(client, {
      type: "system",
      data: { event: "peer_left", peerId: "p3" },
    });
    expect(getState().peerCount).toBe(0);
  });
});

describe("attachClientToStore: host presence", () => {
  it("transitions to host_disconnected with deadline and clears hostPresent", async () => {
    const { client } = await makeClient();
    attachClientToStore(client, useCollabStore);
    await deliver(client, {
      type: "system",
      data: { event: "host_disconnected", deadline: 1700000000000 },
    });
    const s = getState();
    expect(s.status).toBe("host_disconnected");
    expect(s.hostGraceDeadline).toBe(1700000000000);
    expect(s.hostPresent).toBe(false);
  });

  it("transitions back to connected when host returns", async () => {
    const { client } = await makeClient();
    attachClientToStore(client, useCollabStore);
    await deliver(client, {
      type: "system",
      data: { event: "host_disconnected", deadline: 1700000000000 },
    });
    await deliver(client, {
      type: "system",
      data: { event: "host_connected" },
    });
    const s = getState();
    expect(s.status).toBe("connected");
    expect(s.hostGraceDeadline).toBeNull();
    expect(s.hostPresent).toBe(true);
  });

  it("session_ended sets status to ended", async () => {
    const { client } = await makeClient();
    attachClientToStore(client, useCollabStore);
    await deliver(client, {
      type: "system",
      data: { event: "session_ended", reason: "host_left" },
    });
    expect(getState().status).toBe("ended");
  });
});

describe("attachClientToStore: close handling", () => {
  it("transitions to ended on close and records a transport error for non-normal codes", () => {
    const { client } = makeClientSync();
    attachClientToStore(client, useCollabStore);
    client.handleClose(CLOSE_CODES.FORBIDDEN, "invalid-token");
    const s = getState();
    expect(s.status).toBe("ended");
    expect(s.error?.kind).toBe("transport");
    expect(s.error?.message).toContain("invalid-token");
  });

  it("does not record an error for SESSION_ENDED close", () => {
    const { client } = makeClientSync();
    attachClientToStore(client, useCollabStore);
    client.handleClose(CLOSE_CODES.SESSION_ENDED, "session-ended");
    expect(getState().status).toBe("ended");
    expect(getState().error).toBeNull();
  });

  it("does not overwrite an existing error", () => {
    const { client } = makeClientSync();
    attachClientToStore(client, useCollabStore);
    useCollabStore
      .getState()
      .setError({ kind: "rate-limited", message: "first" });
    client.handleClose(CLOSE_CODES.FORBIDDEN, "second");
    expect(getState().error?.kind).toBe("rate-limited");
    expect(getState().error?.message).toBe("first");
  });
});

describe("attachClientToStore: error handling", () => {
  it("propagates fatal error events to the store", () => {
    const { client } = makeClientSync();
    attachClientToStore(client, useCollabStore);
    client.handleTransportError(new Error("ECONNRESET"));
    expect(getState().error?.kind).toBe("transport");
    expect(getState().error?.message).toBe("ECONNRESET");
  });

  it("ignores non-fatal error events (decrypt, send-not-allowed)", async () => {
    const { client } = await makeClient();
    attachClientToStore(client, useCollabStore);

    // Emit a decrypt error by feeding garbage
    await deliver(client, {
      type: "y-update",
      docKind: "prose",
      streamId: 1,
      payload: "AAAAAAAAAAAAAAAAAAAA",
      from: "peer-x",
    });
    expect(getState().error).toBeNull();
  });
});

describe("attachClientToStore: cleanup", () => {
  it("returns an unsubscribe that detaches every listener", async () => {
    const { client } = await makeClient();
    const detach = attachClientToStore(client, useCollabStore);
    detach();
    await deliver(client, {
      type: "system",
      data: { event: "peer_joined", peerId: "p9", role: "view" },
    });
    expect(getState().peerCount).toBe(1);
  });
});

function makeClientSync(): { client: CollabClient } {
  // For tests that don't need an awaited key — exploit the fact that the
  // attach module never actually decrypts here.
  const transport = new MockTransport();
  const fakeKey = {} as RoomKey;
  const client = new CollabClient({ transport, key: fakeKey, role: "edit" });
  return { client };
}
