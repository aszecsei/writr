import { create } from "zustand";
import type { ShareUrls } from "@/lib/collab/lifecycle";
import type { ErrorCode, Role } from "@/lib/collab/protocol";
import type { CollabSession } from "@/lib/collab/session";

/**
 * Connection lifecycle for a host or guest of a collab session.
 *
 * `host_disconnected` is the host-grace-period state guests see while the
 * server holds the room open waiting for the host to return.
 */
export type CollabStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "host_disconnected"
  | "ended";

export interface CollabError {
  kind: ErrorCode | "transport" | "decrypt" | "invalid-message" | "abort";
  message: string;
}

/**
 * Display identity for the local peer. Drives the CollaborationCaret name
 * + color and the `author` / `authorColor` fields on comments this peer
 * authors.
 */
export interface CollabIdentity {
  name: string;
  color: string;
}

export interface CollabState {
  session: CollabSession | null;
  status: CollabStatus;
  role: Role | null;
  peerId: string | null;
  peerCount: number;
  hostPresent: boolean;
  /** Epoch ms when the host-grace timer expires; null when not in grace. */
  hostGraceDeadline: number | null;
  /** Only populated for the host. Three URLs (one per non-host role). */
  shareUrls: ShareUrls | null;
  /** Last terminal error, if any. Cleared on `reset`. */
  error: CollabError | null;
  /** Display name + color used for caret + comment authorship. */
  identity: CollabIdentity | null;

  setSession: (
    session: CollabSession,
    info: { role: Role; peerId: string; hostPresent: boolean },
  ) => void;
  setStatus: (status: CollabStatus) => void;
  setPeerCount: (peerCount: number) => void;
  setHostPresent: (hostPresent: boolean) => void;
  setHostGraceDeadline: (deadline: number | null) => void;
  setShareUrls: (urls: ShareUrls | null) => void;
  setError: (error: CollabError | null) => void;
  setIdentity: (identity: CollabIdentity | null) => void;
  reset: () => void;
}

const INITIAL: Omit<
  CollabState,
  | "setSession"
  | "setStatus"
  | "setPeerCount"
  | "setHostPresent"
  | "setHostGraceDeadline"
  | "setShareUrls"
  | "setError"
  | "setIdentity"
  | "reset"
> = {
  session: null,
  status: "idle",
  role: null,
  peerId: null,
  peerCount: 0,
  hostPresent: false,
  hostGraceDeadline: null,
  shareUrls: null,
  error: null,
  identity: null,
};

export const useCollabStore = create<CollabState>()((set) => ({
  ...INITIAL,
  setSession: (session, info) =>
    set({
      session,
      role: info.role,
      peerId: info.peerId,
      hostPresent: info.hostPresent,
      status: "connected",
      error: null,
    }),
  setStatus: (status) => set({ status }),
  setPeerCount: (peerCount) => set({ peerCount }),
  setHostPresent: (hostPresent) => set({ hostPresent }),
  setHostGraceDeadline: (hostGraceDeadline) => set({ hostGraceDeadline }),
  setShareUrls: (shareUrls) => set({ shareUrls }),
  setError: (error) => set({ error }),
  setIdentity: (identity) => set({ identity }),
  reset: () => set({ ...INITIAL }),
}));

/**
 * Selectors. Components should prefer these over reading the whole state so
 * Zustand's shallow comparison can avoid unnecessary re-renders.
 */
export const collabSelectors = {
  isActive: (s: CollabState): boolean => s.session !== null,
  isHost: (s: CollabState): boolean => s.role === "host",
  canEditProse: (s: CollabState): boolean =>
    s.role === "host" || s.role === "edit",
  canEditComments: (s: CollabState): boolean =>
    s.role === "host" || s.role === "edit" || s.role === "review",
  isInGrace: (s: CollabState): boolean => s.status === "host_disconnected",
};
