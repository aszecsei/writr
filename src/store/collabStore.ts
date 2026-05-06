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
  | "awaiting_approval"
  | "connected"
  | "host_disconnected"
  | "ended"
  | "denied";

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

/**
 * A guest waiting for the host to approve their request to join.
 * Host-only state. The host's approval modal reads the head of this queue.
 */
export interface PendingJoinRequest {
  requestId: string;
  guestPub: string;
  displayName: string;
  color: string;
  /** The peerId the relay assigned to this guest's connection. Needed
   *  to address the join-approved / join-denied response back. */
  from: string;
  receivedAt: number;
}

/**
 * A guest the host has approved during this session, indexed by their
 * X25519 public key. Subsequent join-requests with a known pubkey are
 * auto-approved without surfacing the modal.
 */
export interface ApprovedGuest {
  displayName: string;
  color: string;
  approvedAt: number;
  /** The peerId of the guest's currently-active connection, or null if
   *  they're not connected. Used to evict on revoke. */
  peerId: string | null;
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
  /** Host-only: queue of guests waiting for approval, oldest first. */
  pendingJoinRequests: PendingJoinRequest[];
  /** Host-only: keyed by guestPub (base64url). */
  approvedGuests: Record<string, ApprovedGuest>;
  /**
   * Guest-only. Reason string surfaced on the denied screen when the host
   * rejects the join-request.
   */
  deniedReason: string | null;

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
  addPendingJoinRequest: (req: PendingJoinRequest) => void;
  removePendingJoinRequest: (requestId: string) => void;
  clearPendingJoinRequests: () => void;
  approveGuestPub: (
    guestPub: string,
    info: { displayName: string; color: string; peerId: string },
  ) => void;
  revokeGuestPub: (guestPub: string) => void;
  /** Clear the peerId on whichever approved-guest entry currently holds
   *  it. Called when peer_left fires. */
  clearGuestPeerId: (peerId: string) => void;
  setDeniedReason: (reason: string | null) => void;
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
  | "addPendingJoinRequest"
  | "removePendingJoinRequest"
  | "clearPendingJoinRequests"
  | "approveGuestPub"
  | "revokeGuestPub"
  | "clearGuestPeerId"
  | "setDeniedReason"
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
  pendingJoinRequests: [],
  approvedGuests: {},
  deniedReason: null,
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
  addPendingJoinRequest: (req) =>
    set((s) => {
      if (s.pendingJoinRequests.some((p) => p.requestId === req.requestId)) {
        return {};
      }
      return { pendingJoinRequests: [...s.pendingJoinRequests, req] };
    }),
  removePendingJoinRequest: (requestId) =>
    set((s) => ({
      pendingJoinRequests: s.pendingJoinRequests.filter(
        (p) => p.requestId !== requestId,
      ),
    })),
  clearPendingJoinRequests: () => set({ pendingJoinRequests: [] }),
  approveGuestPub: (guestPub, info) =>
    set((s) => ({
      approvedGuests: {
        ...s.approvedGuests,
        [guestPub]: {
          displayName: info.displayName,
          color: info.color,
          approvedAt: Date.now(),
          peerId: info.peerId,
        },
      },
    })),
  revokeGuestPub: (guestPub) =>
    set((s) => {
      if (!(guestPub in s.approvedGuests)) return {};
      const next = { ...s.approvedGuests };
      delete next[guestPub];
      return { approvedGuests: next };
    }),
  clearGuestPeerId: (peerId) =>
    set((s) => {
      let touched = false;
      const next: Record<string, ApprovedGuest> = {};
      for (const [pub, g] of Object.entries(s.approvedGuests)) {
        if (g.peerId === peerId) {
          next[pub] = { ...g, peerId: null };
          touched = true;
        } else {
          next[pub] = g;
        }
      }
      return touched ? { approvedGuests: next } : {};
    }),
  setDeniedReason: (reason) => set({ deniedReason: reason }),
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
