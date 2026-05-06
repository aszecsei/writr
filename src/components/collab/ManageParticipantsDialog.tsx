"use client";

import { BUTTON_CANCEL } from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import { useCollabManager } from "@/hooks/collab/useCollabManager";
import { useCollabStore } from "@/store/collabStore";
import { isCollabManageParticipantsModal, useUiStore } from "@/store/uiStore";

/**
 * Host-only modal listing previously-approved guests and exposing a
 * Revoke action per guest. Revoking removes the pubkey from the
 * auto-approve set AND, if the guest is currently connected, evicts
 * them via `kick-peer`. They reconnecting later will surface the
 * approval modal again.
 */
export function ManageParticipantsDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const approvedGuests = useCollabStore((s) => s.approvedGuests);
  const pendingCount = useCollabStore((s) => s.pendingJoinRequests.length);
  const openModal = useUiStore((s) => s.openModal);
  const pendingHead = useCollabStore((s) => s.pendingJoinRequests[0]);
  const { revokeGuest } = useCollabManager();

  if (!isCollabManageParticipantsModal(modal)) return null;

  const entries = Object.entries(approvedGuests).sort(
    (a, b) => b[1].approvedAt - a[1].approvedAt,
  );

  return (
    <Modal onClose={closeModal} maxWidth="max-w-lg">
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Participants</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Guests you've approved this session. Revoking removes the
            auto-approve, and if the guest is currently connected they're
            disconnected immediately. They can rejoin only with your
            re-approval.
          </p>
        </div>

        {pendingCount > 0 && pendingHead && (
          <button
            type="button"
            onClick={() =>
              openModal({
                id: "collab-approve-join",
                requestId: pendingHead.requestId,
                displayName: pendingHead.displayName,
                color: pendingHead.color,
              })
            }
            className="flex w-full items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:bg-amber-950/60"
          >
            <span
              aria-hidden="true"
              className="inline-block h-5 w-5 rounded-full"
              style={{ backgroundColor: pendingHead.color }}
            />
            <span className="font-medium">{pendingHead.displayName}</span>
            <span className="text-amber-700 dark:text-amber-300">
              waiting to join
              {pendingCount > 1 ? ` (+${pendingCount - 1} more)` : ""}
            </span>
          </button>
        )}

        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            No approved guests yet.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {entries.map(([pub, info]) => (
              <li
                key={pub}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-5 w-5 flex-none rounded-full"
                  style={{ backgroundColor: info.color }}
                />
                <span className="flex-1 truncate font-medium">
                  {info.displayName}
                </span>
                <button
                  type="button"
                  onClick={() => revokeGuest(pub)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-2">
          <button type="button" onClick={closeModal} className={BUTTON_CANCEL}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
