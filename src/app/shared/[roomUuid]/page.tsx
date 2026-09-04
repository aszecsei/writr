"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CollabProseEditor } from "@/components/collab/CollabProseEditor";
import { DisplayNamePrompt } from "@/components/collab/DisplayNamePrompt";
import {
  GuestSessionShell,
  type GuestState,
} from "@/components/collab/GuestSessionShell";
import { useCollabManager } from "@/hooks/collab/useCollabManager";
import { useCommentsMeta } from "@/hooks/collab/useCommentsMeta";
import {
  readHostPubFromFragment,
  readModeFromFragment,
} from "@/lib/collab/crypto";
import { buildIdentity, readStoredDisplayName } from "@/lib/collab/identity";
import { useCollabStore } from "@/store/collabStore";
import { useSharedProjectStore } from "@/store/sharedProjectStore";

export default function SharedSessionPage() {
  const router = useRouter();
  const params = useParams<{ roomUuid: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [hostPubEncoded, setHostPubEncoded] = useState<string | null>(null);
  const [hostPubResolved, setHostPubResolved] = useState(false);
  const [shareMode, setShareMode] = useState<"chapter" | "project">("chapter");
  const [identity, setIdentityState] = useState<{
    name: string;
    color: string;
  } | null>(null);

  const { enabled, joinAsGuest, end } = useCollabManager({
    ownsLifecycle: true,
  });
  const status = useCollabStore((s) => s.status);
  const role = useCollabStore((s) => s.role);
  const peerCount = useCollabStore((s) => s.peerCount);
  const hostPresent = useCollabStore((s) => s.hostPresent);
  const collabError = useCollabStore((s) => s.error);
  const session = useCollabStore((s) => s.session);
  const deniedReason = useCollabStore((s) => s.deniedReason);
  const sharedMeta = useSharedProjectStore((s) => s.meta);

  // Read the host's public key + share mode from the URL fragment.
  // Fragments are not sent to the server, so this happens entirely
  // client-side after mount.
  useEffect(() => {
    setHostPubEncoded(readHostPubFromFragment(window.location.hash));
    setShareMode(readModeFromFragment(window.location.hash));
    setHostPubResolved(true);
  }, []);

  // If the user has joined a room before, reuse their stored display name
  // without re-prompting. New visitors see DisplayNamePrompt.
  useEffect(() => {
    const stored = readStoredDisplayName();
    if (stored) {
      setIdentityState(buildIdentity({ role: "guest", name: stored }));
    }
  }, []);

  // Auto-join once we have all four inputs (host pubkey, token, room,
  // identity) and the feature is enabled. After a retry, end() clears
  // the store and this effect re-fires on the resulting status change.
  useEffect(() => {
    if (!enabled) return;
    if (!hostPubResolved) return;
    if (!token || !hostPubEncoded || !params.roomUuid) return;
    if (!identity) return;
    if (session) return;
    if (
      status === "connecting" ||
      status === "awaiting_approval" ||
      status === "connected" ||
      status === "denied"
    ) {
      return;
    }
    if (collabError) return;
    void joinAsGuest({
      roomUuid: params.roomUuid,
      token,
      hostPubEncoded,
      identity,
      shareMode,
    }).catch(() => {
      // Failure is recorded on collabStore.error or status=denied; UI reflects it.
    });
  }, [
    enabled,
    hostPubResolved,
    token,
    hostPubEncoded,
    params.roomUuid,
    identity,
    session,
    status,
    collabError,
    joinAsGuest,
    shareMode,
  ]);

  // In project-mode, attach the project reader as soon as we have a
  // session so meta lands in the in-memory store. The reader is detached
  // when this page unmounts (on redirect into the project shell, which
  // will mount its own reader). reset() keeps state coherent.
  useEffect(() => {
    if (shareMode !== "project") return;
    if (!session) return;
    let detach: (() => void) | null = null;
    void import("@/lib/collab/projectReader").then(
      ({ attachProjectReader }) => {
        detach = attachProjectReader({
          doc: session.getDoc("project"),
          store: useSharedProjectStore,
        });
      },
    );
    return () => {
      if (detach) detach();
    };
  }, [shareMode, session]);

  // Once the host's project meta arrives, redirect into the read-only
  // project shell. The URL lands on the active chapter if one exists;
  // otherwise the project landing.
  useEffect(() => {
    if (shareMode !== "project") return;
    if (status !== "connected") return;
    if (!sharedMeta) return;
    const target = sharedMeta.activeChapterId
      ? `/shared/${params.roomUuid}/projects/${sharedMeta.projectId}/chapters/${sharedMeta.activeChapterId}`
      : `/shared/${params.roomUuid}/projects/${sharedMeta.projectId}`;
    router.replace(target);
  }, [shareMode, status, sharedMeta, params.roomUuid, router]);

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
    if (hostPubResolved && !hostPubEncoded) return { kind: "missing-host-key" };
    if (status === "denied") {
      return { kind: "denied", reason: deniedReason };
    }
    if (status === "ended") {
      return { kind: "ended", reason: "session_ended" };
    }
    if (status === "awaiting_approval") {
      return { kind: "awaiting-approval" };
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
    hostPubResolved,
    hostPubEncoded,
    status,
    collabError,
    deniedReason,
  ]);

  // Comments meta (chapterId / projectId) is host-written on the
  // commentsDoc; observe it so the editor can scope new comments
  // correctly the moment the host's setup completes.
  const commentsDoc = session ? session.getDoc("comments") : null;
  const commentsMeta = useCommentsMeta(commentsDoc);

  // Block the auto-join until the user picks a display name. Stored names
  // skip this prompt entirely.
  if (enabled && hostPubResolved && token && hostPubEncoded && !identity) {
    return <DisplayNamePrompt onSubmit={setIdentityState} />;
  }

  // Connected guests get a full-screen layout that mirrors the host's
  // chapter editor — toolbar at top, scrollable prose centered to the
  // editor width, comment margin alongside. Non-connected states keep
  // the card-style GuestSessionShell so error/connecting/ended UIs are
  // legible.
  if (
    status === "connected" &&
    session &&
    role &&
    role !== "host" &&
    identity
  ) {
    return (
      <ConnectedSessionLayout
        role={role}
        peerCount={peerCount}
        hostPresent={hostPresent}
        onLeave={handleClose}
      >
        <CollabProseEditor
          doc={session.getDoc("prose")}
          awareness={session.awareness}
          editable={role === "edit"}
          userName={identity.name}
          userColor={identity.color}
          commentsDoc={commentsDoc ?? undefined}
          chapterId={commentsMeta.chapterId ?? undefined}
          projectId={commentsMeta.projectId ?? undefined}
        />
      </ConnectedSessionLayout>
    );
  }

  return (
    <GuestSessionShell
      state={state}
      onLeave={handleClose}
      onRetry={handleRetry}
    />
  );
}

interface ConnectedSessionLayoutProps {
  role: "view" | "review" | "edit" | "host";
  peerCount: number;
  hostPresent: boolean;
  onLeave: () => void;
  children: React.ReactNode;
}

function ConnectedSessionLayout({
  role,
  peerCount,
  hostPresent,
  onLeave,
  children,
}: ConnectedSessionLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {role}
          </span>
          <span>
            {peerCount === 1 ? "Just you" : `${peerCount} connected`}
            {" · "}
            {hostPresent ? "Host present" : "Host away"}
          </span>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-md border border-neutral-300 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Leave
        </button>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
