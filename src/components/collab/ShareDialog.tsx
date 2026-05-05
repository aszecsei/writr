"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import {
  BUTTON_CANCEL,
  BUTTON_DANGER,
  BUTTON_PRIMARY,
} from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import { useCollabManager } from "@/hooks/collab/useCollabManager";
import type { ShareUrls } from "@/lib/collab/lifecycle";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";

export function ShareDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const status = useCollabStore((s) => s.status);
  const peerCount = useCollabStore((s) => s.peerCount);
  const shareUrls = useCollabStore((s) => s.shareUrls);
  const error = useCollabStore((s) => s.error);
  const { enabled, startAsHost, end } = useCollabManager();

  if (modal.id !== "share-collab-session") return null;
  // Defense in depth: if the env var was unset between dispatch and render,
  // refuse to display the gated UI even though the modal id matched.
  if (!enabled) return null;

  return (
    <Modal onClose={closeModal} maxWidth="max-w-lg">
      <ShareDialogContent
        status={status}
        peerCount={peerCount}
        shareUrls={shareUrls}
        errorMessage={error?.message ?? null}
        onStart={startAsHost}
        onEnd={end}
        onClose={closeModal}
      />
    </Modal>
  );
}

interface ShareDialogContentProps {
  status: ReturnType<typeof useCollabStore.getState>["status"];
  peerCount: number;
  shareUrls: ShareUrls | null;
  errorMessage: string | null;
  onStart: () => Promise<void>;
  onEnd: () => void;
  onClose: () => void;
}

/**
 * Pure presentational body of the share dialog. Split out from
 * `ShareDialog` so it can be snapshotted directly with deterministic
 * inputs.
 */
export function ShareDialogContent({
  status,
  peerCount,
  shareUrls,
  errorMessage,
  onStart,
  onEnd,
  onClose,
}: ShareDialogContentProps) {
  const isConnected = status === "connected" || status === "host_disconnected";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Share session
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Generate three share links — one per role. Anyone with a link can join
          while your tab is open. The relay never sees your content; encryption
          keys live only in the link's <code>#k=</code> fragment.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      {status === "idle" && (
        <IdleState
          onStart={onStart}
          onClose={onClose}
          hadPriorError={errorMessage !== null}
        />
      )}

      {status === "connecting" && <ConnectingState />}

      {isConnected && shareUrls && (
        <ConnectedState
          shareUrls={shareUrls}
          peerCount={peerCount}
          inGrace={status === "host_disconnected"}
          onEnd={onEnd}
          onClose={onClose}
        />
      )}

      {status === "ended" && (
        <IdleState
          onStart={onStart}
          onClose={onClose}
          hadPriorError={errorMessage !== null}
        />
      )}
    </div>
  );
}

function IdleState({
  onStart,
  onClose,
  hadPriorError,
}: {
  onStart: () => Promise<void>;
  onClose: () => void;
  hadPriorError: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const handleStart = useCallback(async () => {
    setBusy(true);
    try {
      await onStart();
    } catch {
      // Error surfaced via store; UI re-renders with error message
    } finally {
      setBusy(false);
    }
  }, [onStart]);
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onClose} className={BUTTON_CANCEL}>
        Cancel
      </button>
      <button
        type="button"
        onClick={handleStart}
        disabled={busy}
        className={BUTTON_PRIMARY}
      >
        {busy ? "Starting…" : hadPriorError ? "Try again" : "Start sharing"}
      </button>
    </div>
  );
}

function ConnectingState() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      <span>Connecting to the relay and minting your session…</span>
    </div>
  );
}

function ConnectedState({
  shareUrls,
  peerCount,
  inGrace,
  onEnd,
  onClose,
}: {
  shareUrls: ShareUrls;
  peerCount: number;
  inGrace: boolean;
  onEnd: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">
          {peerCount === 1
            ? "Just you for now."
            : `${peerCount} people connected.`}
        </span>
        {inGrace && (
          <span className="text-amber-700 dark:text-amber-300">
            Reconnecting…
          </span>
        )}
      </div>

      <ShareLinkRow
        label="Edit"
        description="Can edit prose and add comments."
        url={shareUrls.edit}
      />
      <ShareLinkRow
        label="Review"
        description="Read-only on prose; can leave comments."
        url={shareUrls.review}
      />
      <ShareLinkRow
        label="View"
        description="Read-only."
        url={shareUrls.view}
      />

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className={BUTTON_CANCEL}>
          Close
        </button>
        <button type="button" onClick={onEnd} className={BUTTON_DANGER}>
          End session
        </button>
      </div>
    </div>
  );
}

function ShareLinkRow({
  label,
  description,
  url,
}: {
  label: string;
  description: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available — leave indicator off
    }
  }, [url]);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {label}
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {description}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 truncate rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1.5 font-mono text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          onFocus={(e) => e.currentTarget.select()}
          aria-label={`${label} share URL`}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          aria-label={`Copy ${label} URL`}
        >
          {copied ? (
            <>
              <Check size={12} aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy size={12} aria-hidden="true" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
