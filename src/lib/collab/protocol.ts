// Mirrors collab/src/protocol.ts. Keep in sync with the sidecar.
import { match, P } from "ts-pattern";
import { z } from "zod";

export const ROLES = ["view", "review", "edit", "host"] as const;
export type Role = (typeof ROLES)[number];

export const DOC_KINDS = ["prose", "comments"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const ERROR_CODES = [
  "invalid-token",
  "unauthorized",
  "invalid-message",
  "payload-too-large",
  "rate-limited",
  "room-full",
  "room-not-found",
  "internal",
  "join-rejected",
  "join-timeout",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

const roleSchema = z.enum(ROLES);
const docKindSchema = z.enum(DOC_KINDS);
const streamIdSchema = z.number().int().min(1);
const base64Schema = z.string().regex(/^[A-Za-z0-9+/_-]*={0,2}$/);
const peerIdSchema = z.string().min(1).max(64);
const requestIdSchema = z.string().min(1).max(64);
const displayNameSchema = z.string().min(1).max(64);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const systemEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("host_disconnected"),
    deadline: z.number(),
  }),
  z.object({ event: z.literal("host_connected") }),
  z.object({
    event: z.literal("session_ended"),
    reason: z.enum(["host_left", "idle", "shutdown"]),
  }),
  z.object({
    event: z.literal("peer_joined"),
    peerId: peerIdSchema,
    role: roleSchema,
  }),
  z.object({
    event: z.literal("peer_left"),
    peerId: peerIdSchema,
  }),
  z.object({
    event: z.literal("join_request_cancelled"),
    requestId: requestIdSchema,
  }),
]);

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("welcome"),
    peerId: peerIdSchema,
    role: roleSchema,
    peerCount: z.number().int().min(0),
    hostPresent: z.boolean(),
  }),
  z.object({
    type: z.literal("y-update"),
    docKind: docKindSchema,
    streamId: streamIdSchema,
    payload: base64Schema,
    from: peerIdSchema,
  }),
  z.object({
    type: z.literal("awareness"),
    payload: base64Schema,
    from: peerIdSchema,
  }),
  z.object({
    type: z.literal("meta"),
    streamId: streamIdSchema,
    payload: base64Schema,
    from: peerIdSchema,
  }),
  z.object({
    type: z.literal("rotate-stream"),
    docKind: docKindSchema,
    newStreamId: streamIdSchema,
  }),
  z.object({
    type: z.literal("buffer"),
    docKind: docKindSchema,
    streamId: streamIdSchema,
    updates: z.array(base64Schema),
  }),
  z.object({
    type: z.literal("system"),
    data: systemEventSchema,
  }),
  z.object({
    type: z.literal("error"),
    code: z.enum(ERROR_CODES),
    message: z.string(),
  }),
  z.object({
    type: z.literal("join-request"),
    requestId: requestIdSchema,
    guestPub: base64Schema,
    displayName: displayNameSchema,
    color: colorSchema,
    from: peerIdSchema,
  }),
  z.object({
    type: z.literal("join-approved"),
    requestId: requestIdSchema,
    encryptedRoomKey: base64Schema,
  }),
  z.object({
    type: z.literal("join-denied"),
    requestId: requestIdSchema,
    reason: z.string().max(200).optional(),
  }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type SystemEvent = z.infer<typeof systemEventSchema>;

export type ClientMessage =
  | {
      type: "y-update";
      docKind: DocKind;
      streamId: number;
      payload: string;
    }
  | { type: "awareness"; payload: string }
  | { type: "meta"; streamId: number; payload: string }
  | { type: "rotate-stream"; docKind: DocKind; newStreamId: number }
  | { type: "request-buffer"; docKind: DocKind }
  | {
      type: "join-request";
      requestId: string;
      guestPub: string;
      displayName: string;
      color: string;
    }
  | {
      type: "join-approved";
      requestId: string;
      encryptedRoomKey: string;
      to: string;
    }
  | { type: "join-denied"; requestId: string; reason?: string; to: string }
  | { type: "kick-peer"; peerId: string };

export const CLOSE_CODES = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  POLICY_VIOLATION: 1008,
  MESSAGE_TOO_BIG: 1009,
  INTERNAL_ERROR: 1011,
  UNAUTHORIZED: 4401,
  FORBIDDEN: 4403,
  RATE_LIMITED: 4429,
  ROOM_NOT_FOUND: 4404,
  ROOM_FULL: 4413,
  SESSION_ENDED: 4410,
} as const;

export function canSendClient(role: Role, message: ClientMessage): boolean {
  return match(message)
    .with({ type: P.union("awareness", "request-buffer") }, () => true)
    .with({ type: "y-update" }, (m) => {
      if (role === "view") return false;
      if (role === "review" && m.docKind !== "comments") return false;
      return true;
    })
    .with({ type: P.union("meta", "rotate-stream") }, () => role === "host")
    .with({ type: "join-request" }, () => role !== "host")
    .with(
      { type: P.union("join-approved", "join-denied") },
      () => role === "host",
    )
    .with({ type: "kick-peer" }, () => role === "host")
    .exhaustive();
}
