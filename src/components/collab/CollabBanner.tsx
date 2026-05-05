"use client";

import { LogOut, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useCollabManager } from "@/hooks/collab/useCollabManager";
import type { Role } from "@/lib/collab/protocol";
import { useCollabStore } from "@/store/collabStore";

/**
 * Slim row that appears above the main content when a collab session is
 * active. Gates on enablement and on session presence so the row vanishes
 * entirely when the feature is off or no session is in flight.
 */
export function CollabBanner() {
  const { enabled, end } = useCollabManager();
  const session = useCollabStore((s) => s.session);
  const role = useCollabStore((s) => s.role);
  const status = useCollabStore((s) => s.status);
  const peerCount = useCollabStore((s) => s.peerCount);
  const hostPresent = useCollabStore((s) => s.hostPresent);
  const hostGraceDeadline = useCollabStore((s) => s.hostGraceDeadline);

  if (!enabled) return null;
  if (!session || !role) return null;

  const remainingMs = status === "host_disconnected" ? hostGraceDeadline : null;

  return (
    <CollabBannerContent
      viewerRole={role}
      status={status}
      peerCount={peerCount}
      hostPresent={hostPresent}
      graceDeadline={remainingMs}
      onLeave={end}
    />
  );
}

export interface CollabBannerContentProps {
  viewerRole: Role;
  status: ReturnType<typeof useCollabStore.getState>["status"];
  peerCount: number;
  hostPresent: boolean;
  /** Epoch ms when the host-grace timer expires; null when not in grace. */
  graceDeadline: number | null;
  onLeave: () => void;
  /**
   * Fixed "now" for snapshot tests so the rendered countdown is
   * deterministic. Falls back to live `Date.now()` in production.
   */
  nowOverride?: number;
}

/**
 * Pure presentational banner. Split out so snapshots can pin the exact
 * countdown text without faking timers globally.
 */
export function CollabBannerContent({
  viewerRole,
  status,
  peerCount,
  hostPresent,
  graceDeadline,
  onLeave,
  nowOverride,
}: CollabBannerContentProps) {
  const remainingSec = useGraceCountdown(graceDeadline, nowOverride);
  const isHost = viewerRole === "host";
  const inGrace = status === "host_disconnected";

  const tone = inGrace
    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
    : isHost
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
      : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100";

  const peerLabel = peerCount === 1 ? "1 peer" : `${peerCount} peers`;

  return (
    <output
      aria-live="polite"
      className={`flex items-center gap-3 border-b px-4 py-1.5 text-sm ${tone}`}
    >
      <Users size={14} aria-hidden="true" />
      <span className="font-medium">
        {inGrace
          ? `Host disconnected${
              remainingSec !== null ? ` — ${remainingSec}s left` : ""
            }`
          : isHost
            ? "Sharing as host"
            : `Joined as ${viewerRole}`}
      </span>
      <span className="opacity-80">·</span>
      <span>{peerLabel}</span>
      {!isHost && !inGrace && (
        <>
          <span className="opacity-80">·</span>
          <span>{hostPresent ? "Host present" : "Host away"}</span>
        </>
      )}
      <button
        type="button"
        onClick={onLeave}
        className="ml-auto inline-flex items-center gap-1 rounded border border-current/30 px-2 py-0.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
      >
        <LogOut size={12} aria-hidden="true" />
        {isHost ? "End session" : "Leave"}
      </button>
    </output>
  );
}

/**
 * Returns whole seconds remaining until the deadline, or null when no
 * deadline is set. Re-renders every second while the timer is running.
 */
function useGraceCountdown(
  deadline: number | null,
  nowOverride?: number,
): number | null {
  const [tick, setTick] = useState(() => nowOverride ?? Date.now());
  useEffect(() => {
    if (deadline === null || nowOverride !== undefined) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline, nowOverride]);
  if (deadline === null) return null;
  const ms = Math.max(0, deadline - tick);
  return Math.ceil(ms / 1000);
}
