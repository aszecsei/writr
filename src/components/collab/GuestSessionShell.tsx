"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { match } from "ts-pattern";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";

export type GuestState =
  | { kind: "disabled" }
  | { kind: "missing-token" }
  | { kind: "missing-host-key" }
  | { kind: "connecting" }
  | { kind: "awaiting-approval" }
  | { kind: "denied"; reason: string | null }
  | { kind: "error"; message: string; retryable: boolean }
  | { kind: "ended"; reason: "session_ended" | "left" };

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
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
  return match(state)
    .with({ kind: "disabled" }, () => (
      <Message
        tone="muted"
        title="Collaboration is not enabled"
        description="This Writr build wasn't configured with a collab relay, so shared sessions can't be joined here."
      />
    ))
    .with({ kind: "missing-token" }, () => (
      <Message
        tone="error"
        title="Share link is incomplete"
        description="The link you followed is missing its access token. Ask the person sharing for a fresh link."
      />
    ))
    .with({ kind: "missing-host-key" }, () => (
      <Message
        tone="error"
        title="This invitation link is invalid"
        description="The host key fragment is missing or malformed. Ask the person sharing for a fresh link."
      />
    ))
    .with({ kind: "connecting" }, () => (
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
    ))
    .with({ kind: "awaiting-approval" }, () => (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <Loader2
          size={28}
          className="animate-spin text-neutral-500"
          aria-hidden="true"
        />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Waiting for the host to approve your request…
        </p>
      </div>
    ))
    .with({ kind: "denied" }, (s) => (
      <Message
        tone="error"
        title="The host declined your request"
        description={
          s.reason ?? "You weren't admitted to this collaborative session."
        }
        actions={
          onLeave && (
            <button type="button" onClick={onLeave} className={BUTTON_PRIMARY}>
              Back to home
            </button>
          )
        }
      />
    ))
    .with({ kind: "error" }, (s) => (
      <Message
        tone="error"
        title="Couldn't join the session"
        description={s.message}
        actions={
          <>
            {onLeave && (
              <button type="button" onClick={onLeave} className={BUTTON_CANCEL}>
                Close
              </button>
            )}
            {s.retryable && onRetry && (
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
    ))
    .with({ kind: "ended" }, (s) => (
      <Message
        tone="muted"
        title={
          s.reason === "session_ended"
            ? "The session has ended"
            : "You left the session"
        }
        description="The collab relay has forgotten this room. To rejoin, ask the host for a new share link."
        actions={
          onLeave && (
            <button type="button" onClick={onLeave} className={BUTTON_PRIMARY}>
              Close
            </button>
          )
        }
      />
    ))
    .exhaustive();
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
