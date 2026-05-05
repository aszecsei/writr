"use client";

import { Share2 } from "lucide-react";
import { isCollabEnabled } from "@/lib/collab/config";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";

/**
 * Toolbar button that opens the share dialog. Renders nothing — and
 * does not subscribe to any collab state — when NEXT_PUBLIC_COLLAB_URL
 * is unset, so the non-collab build is unaffected.
 *
 * When a session is already active, the button indicates that visually
 * and still opens the dialog (showing the running session UI).
 */
export function ShareSessionButton() {
  // Read the env at render time. The value is fixed at build time for
  // NEXT_PUBLIC_* vars, so this is a static branch in practice.
  if (!isCollabEnabled()) return null;

  return <ShareSessionButtonImpl />;
}

function ShareSessionButtonImpl() {
  const openModal = useUiStore((s) => s.openModal);
  const isActive = useCollabStore((s) => s.session !== null);
  return (
    <button
      type="button"
      title={isActive ? "Sharing session" : "Share session"}
      aria-label={isActive ? "Sharing session" : "Share session"}
      onClick={() => openModal({ id: "share-collab-session" })}
      className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
        isActive
          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
          : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      }`}
    >
      <Share2 size={16} />
    </button>
  );
}
