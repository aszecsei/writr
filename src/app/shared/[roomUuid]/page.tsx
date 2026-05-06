"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CollabProseEditor } from "@/components/collab/CollabProseEditor";
import {
  GuestSessionShell,
  type GuestState,
} from "@/components/collab/GuestSessionShell";
import { useCollabManager } from "@/hooks/collab/useCollabManager";
import { readShareKeyFromFragment } from "@/lib/collab/crypto";
import { useCollabStore } from "@/store/collabStore";

export default function SharedSessionPage() {
  const router = useRouter();
  const params = useParams<{ roomUuid: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [keyEncoded, setKeyEncoded] = useState<string | null>(null);
  const [keyResolved, setKeyResolved] = useState(false);

  const { enabled, joinAsGuest, end } = useCollabManager();
  const status = useCollabStore((s) => s.status);
  const role = useCollabStore((s) => s.role);
  const peerCount = useCollabStore((s) => s.peerCount);
  const hostPresent = useCollabStore((s) => s.hostPresent);
  const collabError = useCollabStore((s) => s.error);
  const session = useCollabStore((s) => s.session);

  // Read the encryption key from the URL fragment. Fragments are not sent
  // to the server, so this happens entirely client-side after mount.
  useEffect(() => {
    setKeyEncoded(readShareKeyFromFragment(window.location.hash));
    setKeyResolved(true);
  }, []);

  // Auto-join once we have all three inputs and the feature is enabled.
  // After a retry, end() clears the store and this effect re-fires on the
  // resulting status/session change, so no explicit retry counter is needed.
  useEffect(() => {
    if (!enabled) return;
    if (!keyResolved) return;
    if (!token || !keyEncoded || !params.roomUuid) return;
    if (session) return;
    if (status === "connecting" || status === "connected") return;
    if (collabError) return;
    void joinAsGuest({
      roomUuid: params.roomUuid,
      token,
      keyEncoded,
    }).catch(() => {
      // Failure is recorded on collabStore.error; the UI will reflect it.
    });
  }, [
    enabled,
    keyResolved,
    token,
    keyEncoded,
    params.roomUuid,
    session,
    status,
    collabError,
    joinAsGuest,
  ]);

  const handleClose = useCallback(() => {
    end();
    router.replace("/");
  }, [end, router]);

  const handleRetry = useCallback(() => {
    // end() resets the store; the auto-join effect re-fires on the
    // resulting status/error transition.
    end();
  }, [end]);

  const state = useMemo<GuestState>(() => {
    if (!enabled) return { kind: "disabled" };
    if (!token) return { kind: "missing-token" };
    if (keyResolved && !keyEncoded) return { kind: "missing-key" };
    if (status === "connected" && session && role) {
      return {
        kind: "connected",
        role,
        peerCount,
        hostPresent,
      };
    }
    if (status === "ended") {
      return { kind: "ended", reason: "session_ended" };
    }
    if (collabError) {
      return {
        kind: "error",
        message: collabError.message,
        retryable: collabError.kind === "transport",
      };
    }
    return { kind: "connecting" };
  }, [
    enabled,
    token,
    keyResolved,
    keyEncoded,
    status,
    session,
    role,
    peerCount,
    hostPresent,
    collabError,
  ]);

  // When connected, provide the live editor as the shell's connected slot.
  // The 'view' role gets a read-only editor; edit/review can type.
  const connectedContent =
    state.kind === "connected" && session && role !== "host" ? (
      <CollabProseEditor
        doc={session.getDoc("prose")}
        awareness={session.awareness}
        editable={role === "edit"}
      />
    ) : undefined;

  return (
    <GuestSessionShell
      state={state}
      onLeave={handleClose}
      onRetry={handleRetry}
      connectedContent={connectedContent}
    />
  );
}
