"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { OutlineGrid } from "@/components/outline/OutlineGrid";
import {
  getTemplateColumns,
  type OutlineTemplate,
  OutlineTemplateDialog,
} from "@/components/outline/OutlineTemplateDialog";
import { createOutlineGridColumn, createOutlineGridRow } from "@/db/operations";
import type { OutlineGridCellId, ProjectId } from "@/db/schemas";
import { useChaptersByProject } from "@/hooks/data/useChapter";
import {
  useOutlineGridColumns,
  useOutlineGridRows,
} from "@/hooks/outline/useOutlineGrid";
import { useUiStore } from "@/store/uiStore";

export default function OutlinePage() {
  const params = useParams<{ projectId: ProjectId }>();
  const searchParams = useSearchParams();
  const highlightCellId = searchParams.get("highlight");
  const columns = useOutlineGridColumns(params.projectId);
  const rows = useOutlineGridRows(params.projectId);
  const chapters = useChaptersByProject(params.projectId);
  const modal = useUiStore((s) => s.modal);
  const openModal = useUiStore((s) => s.openModal);
  const closeModal = useUiStore((s) => s.closeModal);

  const hasInitialized = useRef(false);

  // Show template dialog when grid is empty
  useEffect(() => {
    if (hasInitialized.current) return;
    if (columns === undefined || rows === undefined || chapters === undefined)
      return;

    if (columns.length > 0 || rows.length > 0) {
      hasInitialized.current = true;
      return;
    }

    hasInitialized.current = true;
    openModal({ id: "outline-template" });
  }, [columns, rows, chapters, openModal]);

  const handleTemplateSelect = async (template: OutlineTemplate) => {
    closeModal();

    const templateColumns = getTemplateColumns(template);

    for (let i = 0; i < templateColumns.length; i++) {
      await createOutlineGridColumn({
        projectId: params.projectId,
        title: templateColumns[i],
        order: i,
      });
    }

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
      <div className="border-b border-neutral-200 px-8 py-4 dark:border-neutral-800">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Outline
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Organize your story in a spreadsheet-style grid.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <OutlineGrid
          projectId={params.projectId}
          highlightCellId={highlightCellId as OutlineGridCellId | null}
        />
      </div>

      {modal.id === "outline-template" && (
        <OutlineTemplateDialog
          onSelect={handleTemplateSelect}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
