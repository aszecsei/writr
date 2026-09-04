import type { ReactNode } from "react";

/**
 * Shared chrome for the guest-facing page headers (`ConnectedSessionLayout`
 * in the /shared/[uuid] entry page, and `SharedProjectLayout`'s header) —
 * both rendered a byte-identical `<header>` wrapper before this extraction.
 * `CollabBanner` is intentionally not built on this: it's a live-region
 * status row (`role="status"`), not a page header, and its host-only
 * affordances (grace countdown, pending-approval pill) don't fit this
 * left/right slot shape.
 */
export function SessionHeaderBar({
  left,
  right,
}: {
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
      {left}
      {right}
    </header>
  );
}

export function RolePill({ role }: { role: string }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
      {role}
    </span>
  );
}
