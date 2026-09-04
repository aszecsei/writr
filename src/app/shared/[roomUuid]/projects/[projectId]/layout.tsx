"use client";

import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { HostMovedBanner } from "@/components/collab/HostMovedBanner";
import { RolePill, SessionHeaderBar } from "@/components/collab/SessionHeader";
import { DataSourceProvider } from "@/context/DataSourceContext";
import { attachProjectReader } from "@/lib/collab/projectReader";
import { collabSelectors, useCollabStore } from "@/store/collabStore";
import { useSharedProjectStore } from "@/store/sharedProjectStore";

/**
 * Guest-side wrapper for the read-only project shell. Mounts the
 * project reader against the live session's project Y.Doc so all the
 * page bodies under this tree see synced state via
 * `useSharedProjectStore`. Provides `DataSourceContext={"shared"}` so
 * the source-aware hooks branch into the in-memory store.
 *
 * If the session ever drops below the project-mode requirements, the
 * shell punts back to the chapter-only entry page so the user sees a
 * coherent error / "ended" state instead of a blank shell.
 */
export default function SharedProjectLayout({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams<{ roomUuid: string; projectId: string }>();
  const router = useRouter();
  const session = useCollabStore((s) => s.session);
  const role = useCollabStore((s) => s.role);
  const isProjectMode = useCollabStore(collabSelectors.isProjectMode);
  const meta = useSharedProjectStore((s) => s.meta);

  // Wire the project Y.Doc into the in-memory store. Detach on unmount.
  useEffect(() => {
    if (!session) return;
    if (!isProjectMode) return;
    const doc = session.getDoc("project");
    const detach = attachProjectReader({
      doc,
      store: useSharedProjectStore,
    });
    return () => {
      detach();
      useSharedProjectStore.getState().reset();
    };
  }, [session, isProjectMode]);

  // Guard: if the URL projectId doesn't match the host's projectId in
  // the synced meta, bail to the room entry page so the user can re-
  // join cleanly. Tolerates the brief window before meta arrives.
  useEffect(() => {
    if (!meta) return;
    if (meta.projectId !== params.projectId) {
      router.replace(`/shared/${params.roomUuid}`);
    }
  }, [meta, params.projectId, params.roomUuid, router]);

  if (!session || !isProjectMode) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-neutral-500">Connecting to shared project…</p>
      </div>
    );
  }

  return (
    <DataSourceProvider source={{ kind: "shared", roomUuid: params.roomUuid }}>
      <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <SessionHeaderBar
          left={
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Read-only project share
            </span>
          }
          right={<RolePill role={role ?? "guest"} />}
        />
        <HostMovedBanner />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </DataSourceProvider>
  );
}
