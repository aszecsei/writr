import { describe, expect, it } from "vitest";
import {
  type ClientMessage,
  canSendClient,
  type Role,
  serverMessageSchema,
} from "./protocol";

describe("serverMessageSchema (handshake variants)", () => {
  it("accepts a well-formed message of each handshake type", () => {
    expect(
      serverMessageSchema.safeParse({
        type: "join-request",
        requestId: "req-1",
        guestPub: "abcDEF_-",
        displayName: "Alice",
        color: "#a1b2c3",
        from: "p-guest-1",
      }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: "join-approved",
        requestId: "req-1",
        encryptedRoomKey: "abc_DEF-12==",
      }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({ type: "join-denied", requestId: "req-1" })
        .success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: "join-denied",
        requestId: "req-1",
        reason: "no thanks",
      }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: "system",
        data: { event: "join_request_cancelled", requestId: "req-1" },
      }).success,
    ).toBe(true);
  });

  it.each([
    [
      "a malformed color",
      {
        type: "join-request",
        requestId: "req-1",
        guestPub: "abc",
        displayName: "Alice",
        color: "red",
        from: "p-guest",
      },
    ],
    [
      "an empty displayName",
      {
        type: "join-request",
        requestId: "req-1",
        guestPub: "abc",
        displayName: "",
        color: "#000000",
        from: "p-guest",
      },
    ],
  ])("rejects a join-request with %s", (_label, payload) => {
    expect(serverMessageSchema.safeParse(payload).success).toBe(false);
  });
});

describe("canSendClient (role x message matrix)", () => {
  const joinReq: ClientMessage = {
    type: "join-request",
    requestId: "r",
    guestPub: "x",
    displayName: "Alice",
    color: "#000000",
  };
  const joinApproved: ClientMessage = {
    type: "join-approved",
    requestId: "r",
    encryptedRoomKey: "x",
    to: "p",
  };
  const joinDenied: ClientMessage = {
    type: "join-denied",
    requestId: "r",
    to: "p",
  };
  const proseUpdate: ClientMessage = {
    type: "y-update",
    docKind: "prose",
    streamId: 1,
    payload: "abc",
  };
  const commentsUpdate: ClientMessage = {
    type: "y-update",
    docKind: "comments",
    streamId: 1,
    payload: "abc",
  };
  const projectUpdate: ClientMessage = {
    type: "y-update",
    docKind: "project",
    streamId: 1,
    payload: "abc",
  };

  it.each([
    ["edit", "join-request", joinReq, true],
    ["review", "join-request", joinReq, true],
    ["view", "join-request", joinReq, true],
    ["host", "join-request", joinReq, false],
    ["host", "join-approved", joinApproved, true],
    ["host", "join-denied", joinDenied, true],
    ["edit", "join-approved", joinApproved, false],
    ["edit", "join-denied", joinDenied, false],
    ["view", "join-approved", joinApproved, false],
    ["host", "prose y-update", proseUpdate, true],
    ["host", "comments y-update", commentsUpdate, true],
    ["host", "project y-update", projectUpdate, true],
    ["edit", "project y-update", projectUpdate, false],
    ["review", "project y-update", projectUpdate, false],
    ["view", "project y-update", projectUpdate, false],
    ["edit", "prose y-update", proseUpdate, true],
    ["edit", "comments y-update", commentsUpdate, true],
    ["review", "prose y-update", proseUpdate, false],
    ["review", "comments y-update", commentsUpdate, true],
    ["view", "prose y-update", proseUpdate, false],
    ["view", "comments y-update", commentsUpdate, false],
  ] as const)(
    "%s sending %s -> allowed=%s",
    (role, _label, message, expected) => {
      expect(canSendClient(role as Role, message)).toBe(expected);
    },
  );
});
