import type { ReactNode } from "react";

/**
 * Slim layout for the guest collab route. Deliberately doesn't pull in
 * AppShell, the sidebar, or any project / Dexie context — guests don't
 * have a local project, just a live encrypted session.
 */
export default function SharedSessionLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
