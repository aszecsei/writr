import { match, P } from "ts-pattern";
import { z } from "zod";

export const ROLES = ["view", "review", "edit", "host"] as const;
export type Role = (typeof ROLES)[number];

export const DOC_KINDS = ["prose", "comments", "project"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

const roleSchema = z.enum(ROLES);
const docKindSchema = z.enum(DOC_KINDS);
const streamIdSchema = z.number().int().min(1);
const base64Schema = z.string().regex(/^[A-Za-z0-9+/_-]*={0,2}$/);
const peerIdSchema = z.string().min(1).max(64);
const requestIdSchema = z.string().min(1).max(64);
const displayNameSchema = z.string().min(1).max(64);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const MAX_PAYLOAD_BYTES = 256 * 1024;

const yUpdateSchema = z.object({
  type: z.literal("y-update"),
  docKind: docKindSchema,
  streamId: streamIdSchema,
  payload: base64Schema,
});

const awarenessSchema = z.object({
  type: z.literal("awareness"),
  payload: base64Schema,
});

const metaSchema = z.object({
  type: z.literal("meta"),
  streamId: streamIdSchema,
  payload: base64Schema,
});

const rotateStreamSchema = z.object({
  type: z.literal("rotate-stream"),
  docKind: docKindSchema,
  newStreamId: streamIdSchema,
});

const requestBufferSchema = z.object({
  type: z.literal("request-buffer"),
  docKind: docKindSchema,
});

const joinRequestClientSchema = z.object({
  type: z.literal("join-request"),
  requestId: requestIdSchema,
  guestPub: base64Schema,
  displayName: displayNameSchema,
  color: colorSchema,
});

const joinApprovedClientSchema = z.object({
  type: z.literal("join-approved"),
  requestId: requestIdSchema,
  encryptedRoomKey: base64Schema,
  to: peerIdSchema,
});

const joinDeniedClientSchema = z.object({
  type: z.literal("join-denied"),
  requestId: requestIdSchema,
  reason: z.string().max(200).optional(),
  to: peerIdSchema,
});

const kickPeerClientSchema = z.object({
  type: z.literal("kick-peer"),
  peerId: peerIdSchema,
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  yUpdateSchema,
  awarenessSchema,
  metaSchema,
  rotateStreamSchema,
  requestBufferSchema,
  joinRequestClientSchema,
  joinApprovedClientSchema,
  joinDeniedClientSchema,
  kickPeerClientSchema,
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type SystemEvent =
  | { event: "host_disconnected"; deadline: number }
  | { event: "host_connected" }
  | { event: "session_ended"; reason: "host_left" | "idle" | "shutdown" }
  | { event: "peer_joined"; peerId: string; role: Role }
  | { event: "peer_left"; peerId: string }
  | { event: "join_request_cancelled"; requestId: string };

export type ServerMessage =
  | {
      type: "welcome";
      peerId: string;
      role: Role;
      peerCount: number;
      hostPresent: boolean;
    }
  | {
      type: "y-update";
      docKind: DocKind;
      streamId: number;
      payload: string;
      from: string;
    }
  | { type: "awareness"; payload: string; from: string }
  | { type: "meta"; streamId: number; payload: string; from: string }
  | { type: "rotate-stream"; docKind: DocKind; newStreamId: number }
  | { type: "buffer"; docKind: DocKind; streamId: number; updates: string[] }
  | { type: "system"; data: SystemEvent }
  | { type: "error"; code: ErrorCode; message: string }
  | {
      type: "join-request";
      requestId: string;
      guestPub: string;
      displayName: string;
      color: string;
      from: string;
    }
  | {
      type: "join-approved";
      requestId: string;
      encryptedRoomKey: string;
    }
  | {
      type: "join-denied";
      requestId: string;
      reason?: string;
    };

export type ErrorCode =
  | "invalid-token"
  | "unauthorized"
  | "invalid-message"
  | "payload-too-large"
  | "rate-limited"
  | "room-full"
  | "room-not-found"
  | "internal"
  | "join-rejected"
  | "join-timeout";

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

export function canSend(
  role: Role,
  message: ClientMessage,
): { allowed: true } | { allowed: false; reason: ErrorCode } {
  return match(message)
    .with({ type: P.union("awareness", "request-buffer") }, () => ({
      allowed: true as const,
    }))
    .with({ type: "y-update" }, (m) => {
      if (m.docKind === "project") {
        if (role !== "host") {
          return { allowed: false as const, reason: "unauthorized" as const };
        }
        return { allowed: true as const };
      }
      if (role === "view") {
        return { allowed: false as const, reason: "unauthorized" as const };
      }
      if (role === "review" && m.docKind !== "comments") {
        return { allowed: false as const, reason: "unauthorized" as const };
      }
      return { allowed: true as const };
    })
    .with({ type: P.union("meta", "rotate-stream") }, () => {
      if (role !== "host") {
        return { allowed: false as const, reason: "unauthorized" as const };
      }
      return { allowed: true as const };
    })
    .with({ type: "join-request" }, () => {
      if (role === "host") {
        return { allowed: false as const, reason: "unauthorized" as const };
      }
      return { allowed: true as const };
    })
    .with({ type: P.union("join-approved", "join-denied") }, () => {
      if (role !== "host") {
        return { allowed: false as const, reason: "unauthorized" as const };
      }
      return { allowed: true as const };
    })
    .with({ type: "kick-peer" }, () => {
      if (role !== "host") {
        return { allowed: false as const, reason: "unauthorized" as const };
      }
      return { allowed: true as const };
    })
    .exhaustive();
}

export { peerIdSchema, roleSchema };
