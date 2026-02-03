"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { OutlineBoard } from "@/components/outline/OutlineBoard";
import { createOutlineColumn } from "@/db/operations";
import { useOutlineColumnsByProject } from "@/hooks/useOutline";

const DEFAULT_COLUMNS = [
  "Act I",
  "Act II.A",
  "Midpoint",
  "Act II.B",
  "Act III",
];

export default function OutlinePage() {
  const params = useParams<{ projectId: string }>();
  const columns = useOutlineColumnsByProject(params.projectId);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current || columns === undefined) return;
    if (columns.length === 0) {
      hasInitialized.current = true;
      (async () => {
        for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
          await createOutlineColumn({
            projectId: params.projectId,
            title: DEFAULT_COLUMNS[i],
            order: i,
          });
        }
      })();
    } else {
      hasInitialized.current = true;
    }
  }, [columns, params.projectId]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-8 py-4 dark:border-zinc-800">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Outline
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Organize your story with a corkboard of index cards.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <OutlineBoard projectId={params.projectId} />
      </div>
    </div>
  );
}
