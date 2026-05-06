"use client";

import { useCallback, useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import { useCollabManager } from "@/hooks/collab/useCollabManager";
import { useCollabStore } from "@/store/collabStore";
import { isCollabApproveJoinModal, useUiStore } from "@/store/uiStore";

/**
 * Host-only modal that surfaces a pending guest join-request and exposes
 * Approve / Decline actions. Reads the request payload from `uiStore.modal`
 * so we don't duplicate state. The pending queue lives on `collabStore`
 * and surfaces a "+N more waiting" caption when more than one is queued.
 */
export function ApproveJoinDialog() {
  const modal = useUiStore((s) => s.modal);
  const pendingCount = useCollabStore((s) => s.pendingJoinRequests.length);
  const { approveJoinRequest, denyJoinRequest } = useCollabManager();
  const [busy, setBusy] = useState(false);

  const handleDeny = useCallback(() => {
    if (!isCollabApproveJoinModal(modal)) return;
    denyJoinRequest(modal.requestId);
  }, [modal, denyJoinRequest]);

  const handleApprove = useCallback(async () => {
    if (!isCollabApproveJoinModal(modal)) return;
    setBusy(true);
    try {
      await approveJoinRequest(modal.requestId);
    } finally {
      setBusy(false);
    }
  }, [modal, approveJoinRequest]);

  if (!isCollabApproveJoinModal(modal)) return null;

  // "+N more waiting" — N excludes the current request.
  const moreWaiting = Math.max(0, pendingCount - 1);

  return (
    <Modal onClose={handleDeny}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block h-8 w-8 rounded-full"
            style={{ backgroundColor: modal.color }}
          />
          <div>
            <h2 className="text-lg font-semibold">Someone wants to join</h2>
            <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {modal.displayName}
              </span>{" "}
              is requesting access to your collaborative session.
            </p>
          </div>
        </div>
        {moreWaiting > 0 && (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            +{moreWaiting} more waiting
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleDeny}
            disabled={busy}
            className={BUTTON_CANCEL}
          >
            Decline
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            className={BUTTON_PRIMARY}
          >
            {busy ? "Approving…" : "Approve"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Convenience: closes the modal when the host's session ends. No-op when
 * the modal isn't an approve-join one, so it's safe to mount globally.
 */
export function useCloseApproveJoinOnSessionEnd(): void {
  const status = useCollabStore((s) => s.status);
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  if (
    (status === "ended" || status === "idle") &&
    isCollabApproveJoinModal(modal)
  ) {
    closeModal();
  }
}
