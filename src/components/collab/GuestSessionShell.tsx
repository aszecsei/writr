"use client";

import { AlertCircle, Loader2, LogOut } from "lucide-react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import type { Role } from "@/lib/collab/protocol";

export type GuestState =
  | { kind: "disabled" }
  | { kind: "missing-token" }
  | { kind: "missing-key" }
  | { kind: "connecting" }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "ended"; reason: "session_ended" | "left" }
  | {
      kind: "connected";
      role: Role;
      peerCount: number;
      hostPresent: boolean;
    };

export interface GuestSessionShellProps {
  state: GuestState;
  onRetry?: () => void;
  onLeave?: () => void;
}

/**
 * Pure presentational shell for the /shared/[uuid] guest page.
 * Snapshot-friendly: every state is a deterministic function of `state`.
 */
export function GuestSessionShell({
  state,
  onRetry,
  onLeave,
}: GuestSessionShellProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <Body state={state} onRetry={onRetry} onLeave={onLeave} />
      </div>
    </div>
  );
}

function Body({
  state,
  onRetry,
  onLeave,
}: {
  state: GuestState;
  onRetry?: () => void;
  onLeave?: () => void;
}) {
  switch (state.kind) {
    case "disabled":
      return (
        <Message
          tone="muted"
          title="Collaboration is not enabled"
          description="This Writr build wasn't configured with a collab relay, so shared sessions can't be joined here."
        />
      );
    case "missing-token":
      return (
        <Message
          tone="error"
          title="Share link is incomplete"
          description="The link you followed is missing its access token. Ask the person sharing for a fresh link."
        />
      );
    case "missing-key":
      return (
        <Message
          tone="error"
          title="Share link is incomplete"
          description="The encryption key fragment is missing from the URL. Without it the relay can't be opened."
        />
      );
    case "connecting":
      return (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <Loader2
            size={28}
            className="animate-spin text-neutral-500"
            aria-hidden="true"
          />
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Joining the session…
          </p>
        </div>
      );
    case "error":
      return (
        <Message
          tone="error"
          title="Couldn't join the session"
          description={state.message}
          actions={
            <>
              {onLeave && (
                <button
                  type="button"
                  onClick={onLeave}
                  className={BUTTON_CANCEL}
                >
                  Close
                </button>
              )}
              {state.retryable && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className={BUTTON_PRIMARY}
                >
                  Try again
                </button>
              )}
            </>
          }
        />
      );
    case "ended":
      return (
        <Message
          tone="muted"
          title={
            state.reason === "session_ended"
              ? "The session has ended"
              : "You left the session"
          }
          description="The collab relay has forgotten this room. To rejoin, ask the host for a new share link."
          actions={
            onLeave && (
              <button
                type="button"
                onClick={onLeave}
                className={BUTTON_PRIMARY}
              >
                Close
              </button>
            )
          }
        />
      );
    case "connected":
      return (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Joined as {state.role}</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {state.peerCount === 1
                ? "You are the only one connected."
                : `${state.peerCount} people connected.`}{" "}
              {state.hostPresent ? "Host is present." : "Host is away."}
            </p>
          </div>
          <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-400">
            The collaborative editor will mount here in the next change. For now
            your session is live and the relay is forwarding awareness updates
            between peers.
          </div>
          {onLeave && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onLeave}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <LogOut size={14} aria-hidden="true" />
                Leave
              </button>
            </div>
          )}
        </div>
      );
  }
}

function Message({
  tone,
  title,
  description,
  actions,
}: {
  tone: "muted" | "error";
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <AlertCircle
          size={32}
          className={
            tone === "error"
              ? "text-red-500 dark:text-red-400"
              : "text-neutral-400 dark:text-neutral-500"
          }
          aria-hidden="true"
        />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
      {actions && (
        <div className="flex justify-center gap-3 pt-2">{actions}</div>
      )}
    </div>
  );
}
