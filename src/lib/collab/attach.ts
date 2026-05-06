import type { CollabError, useCollabStore } from "@/store/collabStore";
import type { CollabClient } from "./client";
import { CLOSE_CODES } from "./protocol";

type CollabStoreApi = typeof useCollabStore;

/**
 * Subset of error kinds that should propagate to the store as terminal
 * errors. `decrypt` and `send-not-allowed` are intentionally excluded —
 * a single bad payload from a malicious peer shouldn't tear down the
 * whole UI; we just drop the message and keep going.
 */
const FATAL_ERROR_KINDS: ReadonlySet<string> = new Set([
  "transport",
  "unauthorized",
  "room-not-found",
  "room-full",
  "rate-limited",
  "invalid-token",
  "invalid-message",
  "internal",
  "payload-too-large",
]);

/**
 * Subscribe a CollabClient to the collabStore so that all state mutations
 * (peer counts, host presence, grace deadlines, terminal errors, session
 * end) are reflected reactively. Pure orchestration — does not own the
 * connection lifecycle. The caller is responsible for:
 *
 *   1. Setting initial state (`setSession`, `setPeerCount`) right after
 *      the welcome resolves.
 *   2. Calling the returned cleanup function on unmount or when the
 *      session is torn down.
 *
 * Returns an unsubscribe that detaches every listener.
 */
export function attachClientToStore(
  client: CollabClient,
  store: CollabStoreApi,
): () => void {
  const unsubs: Array<() => void> = [];

  unsubs.push(
    client.on("system", (event) => {
      const s = store.getState();
      switch (event.event) {
        case "host_disconnected":
          s.setHostPresent(false);
          s.setHostGraceDeadline(event.deadline);
          s.setStatus("host_disconnected");
          return;
        case "host_connected":
          s.setHostPresent(true);
          s.setHostGraceDeadline(null);
          s.setStatus("connected");
          return;
        case "session_ended":
          s.setStatus("ended");
          return;
        case "peer_joined":
          s.setPeerCount(s.peerCount + 1);
          return;
        case "peer_left":
          s.setPeerCount(Math.max(0, s.peerCount - 1));
          return;
        case "join_request_cancelled":
          // Handled by attachJoinRequestHandler — no store mutation here.
          return;
      }
    }),
  );

  unsubs.push(
    client.on("close", ({ code, reason }) => {
      const s = store.getState();
      if (s.status !== "ended") s.setStatus("ended");
      if (
        !s.error &&
        code !== CLOSE_CODES.NORMAL &&
        code !== CLOSE_CODES.SESSION_ENDED
      ) {
        s.setError({
          kind: "transport",
          message: reason || `Connection closed (code ${code})`,
        });
      }
    }),
  );

  unsubs.push(
    client.on("error", (event) => {
      if (!FATAL_ERROR_KINDS.has(event.kind)) return;
      const s = store.getState();
      if (s.error) return;
      // Both unions share the kinds gated by FATAL_ERROR_KINDS.
      s.setError({
        kind: event.kind as CollabError["kind"],
        message: event.message,
      });
    }),
  );

  return () => {
    for (const off of unsubs) off();
    unsubs.length = 0;
  };
}
