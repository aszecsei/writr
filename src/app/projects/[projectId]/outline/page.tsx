"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OutlineGrid } from "@/components/outline/OutlineGrid";
import {
  getTemplateColumns,
  type OutlineTemplate,
  OutlineTemplateDialog,
} from "@/components/outline/OutlineTemplateDialog";
import { createOutlineGridColumn, createOutlineGridRow } from "@/db/operations";
import { useChaptersByProject } from "@/hooks/useChapter";
import {
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/useOutlineGrid";

export default function OutlinePage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const highlightCellId = searchParams.get("highlight");
  const columns = useOutlineGridColumns(params.projectId);
  const rows = useOutlineGridRows(params.projectId);
  const chapters = useChaptersByProject(params.projectId);

  const hasInitialized = useRef(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // Show template dialog when grid is empty
  useEffect(() => {
    if (hasInitialized.current) return;
    if (columns === undefined || rows === undefined || chapters === undefined)
      return;

    // Grid has data, no need for template
    if (columns.length > 0 || rows.length > 0) {
      hasInitialized.current = true;
      return;
    }

    // Grid is empty, show template dialog
    hasInitialized.current = true;
    setShowTemplateDialog(true);
  }, [columns, rows, chapters]);

  const handleTemplateSelect = async (template: OutlineTemplate) => {
    setShowTemplateDialog(false);

    const templateColumns = getTemplateColumns(template);

    // Create columns from template
    for (let i = 0; i < templateColumns.length; i++) {
      await createOutlineGridColumn({
        projectId: params.projectId,
        title: templateColumns[i],
        order: i,
      });
    }

    // Create rows from existing chapters (if any)
    if (chapters && chapters.length > 0) {
      for (let i = 0; i < chapters.length; i++) {
        await createOutlineGridRow({
          projectId: params.projectId,
          linkedChapterId: chapters[i].id,
          label: "",
          order: i,
        });
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-8 py-4 dark:border-zinc-800">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Outline
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Organize your story in a spreadsheet-style grid.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <OutlineGrid
          projectId={params.projectId}
          highlightCellId={highlightCellId}
        />
      </div>

      {showTemplateDialog && (
        <OutlineTemplateDialog
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateDialog(false)}
        />
      )}
    </div>
  );
}
