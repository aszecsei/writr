import { match } from "ts-pattern";
import type { CollabError, useCollabStore } from "@/store/collabStore";
import type { CollabClient } from "./client";
import { CLOSE_CODES, isFatalErrorKind } from "./protocol";

type CollabStoreApi = typeof useCollabStore;

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
      match(event)
        .with({ event: "host_disconnected" }, (e) => {
          s.setHostPresent(false);
          s.setHostGraceDeadline(e.deadline);
          s.setStatus("host_disconnected");
        })
        .with({ event: "host_connected" }, () => {
          s.setHostPresent(true);
          s.setHostGraceDeadline(null);
          s.setStatus("connected");
        })
        .with({ event: "session_ended" }, () => {
          s.setStatus("ended");
        })
        .with({ event: "peer_joined" }, () => {
          s.setPeerCount(s.peerCount + 1);
        })
        .with({ event: "peer_left" }, () => {
          s.setPeerCount(Math.max(0, s.peerCount - 1));
        })
        // Handled by attachJoinRequestHandler — no store mutation here.
        .with({ event: "join_request_cancelled" }, () => {})
        .exhaustive();
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
      // `decrypt` and `send-not-allowed` are intentionally excluded — a
      // single bad payload from a malicious peer shouldn't tear down the
      // whole UI; we just drop the message and keep going.
      if (!isFatalErrorKind(event.kind)) return;
      const s = store.getState();
      if (s.error) return;
      // Both unions share the kinds gated by isFatalErrorKind.
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
