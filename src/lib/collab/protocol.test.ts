import { describe, expect, it } from "vitest";
import {
  type ClientMessage,
  canSendClient,
  serverMessageSchema,
} from "./protocol";

describe("serverMessageSchema (handshake variants)", () => {
  it("accepts a join-request from the server (with from peerId)", () => {
    const result = serverMessageSchema.safeParse({
      type: "join-request",
      requestId: "req-1",
      guestPub: "abcDEF_-",
      displayName: "Alice",
      color: "#a1b2c3",
      from: "p-guest-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a join-request with a malformed color", () => {
    const result = serverMessageSchema.safeParse({
      type: "join-request",
      requestId: "req-1",
      guestPub: "abc",
      displayName: "Alice",
      color: "red",
      from: "p-guest",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a join-request with an empty displayName", () => {
    const result = serverMessageSchema.safeParse({
      type: "join-request",
      requestId: "req-1",
      guestPub: "abc",
      displayName: "",
      color: "#000000",
      from: "p-guest",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a join-approved with encryptedRoomKey", () => {
    const result = serverMessageSchema.safeParse({
      type: "join-approved",
      requestId: "req-1",
      encryptedRoomKey: "abc_DEF-12==",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a join-denied with optional reason", () => {
    expect(
      serverMessageSchema.safeParse({
        type: "join-denied",
        requestId: "req-1",
      }).success,
    ).toBe(true);
    expect(
      serverMessageSchema.safeParse({
        type: "join-denied",
        requestId: "req-1",
        reason: "no thanks",
      }).success,
    ).toBe(true);
  });

  it("accepts a system join_request_cancelled event", () => {
    const result = serverMessageSchema.safeParse({
      type: "system",
      data: { event: "join_request_cancelled", requestId: "req-1" },
    });
    expect(result.success).toBe(true);
  });
});

describe("canSendClient (role gating for handshake messages)", () => {
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

  it("guests can send join-request; host cannot", () => {
    expect(canSendClient("edit", joinReq)).toBe(true);
    expect(canSendClient("review", joinReq)).toBe(true);
    expect(canSendClient("view", joinReq)).toBe(true);
    expect(canSendClient("host", joinReq)).toBe(false);
  });

  it("only host can send join-approved / join-denied", () => {
    expect(canSendClient("host", joinApproved)).toBe(true);
    expect(canSendClient("host", joinDenied)).toBe(true);
    expect(canSendClient("edit", joinApproved)).toBe(false);
    expect(canSendClient("edit", joinDenied)).toBe(false);
    expect(canSendClient("view", joinApproved)).toBe(false);
  });
});
