"use client";

import {
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  CornerDownRight,
  Download,
  FileText,
  Pencil,
  Plus,
  SeparatorHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";
import type { Chapter, ChapterId } from "@/db/schemas";
import type { BinderSectionLabels } from "./BinderSection";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "revised", label: "Revised" },
  { value: "final", label: "Final" },
] as const;

/** The chapter/separator right-click menu: rename, add, move, status, delete. */
export function BinderContextMenu({
  chapterId,
  chapter,
  position,
  labels,
  nestingEnabled,
  onClose,
  onRenameStart,
  onAddChild,
  onAddSibling,
  onAddSeparator,
  onMoveToOther,
  onOpenSeparatorSettings,
  onExport,
  onEditSummary,
  onSetStatus,
  onDelete,
}: {
  chapterId: ChapterId;
  chapter: Chapter | undefined;
  position: { x: number; y: number };
  labels: BinderSectionLabels;
  nestingEnabled: boolean;
  onClose: () => void;
  onRenameStart: (chapterId: ChapterId, currentTitle: string) => void;
  onAddChild: (chapterId: ChapterId) => void;
  onAddSibling: (chapterId: ChapterId) => void;
  onAddSeparator: (chapterId: ChapterId) => void;
  onMoveToOther: (chapterId: ChapterId) => void;
  onOpenSeparatorSettings: (chapterId: ChapterId) => void;
  onExport: (chapterId: ChapterId) => void;
  onEditSummary: (chapterId: ChapterId) => void;
  onSetStatus: (
    chapterId: ChapterId,
    status: "draft" | "revised" | "final",
  ) => void;
  onDelete: (chapterId: ChapterId) => void;
}) {
  const isMenuDocument = chapter?.kind !== "separator";

  return (
    <ContextMenu position={position} onClose={onClose}>
      <ContextMenuItem
        icon={Pencil}
        onClick={() => {
          if (chapter) onRenameStart(chapter.id, chapter.title);
        }}
      >
        Rename
      </ContextMenuItem>
      {isMenuDocument && nestingEnabled && (
        <ContextMenuItem
          icon={CornerDownRight}
          onClick={() => onAddChild(chapterId)}
        >
          {labels.addNested}
        </ContextMenuItem>
      )}
      <ContextMenuItem icon={Plus} onClick={() => onAddSibling(chapterId)}>
        {labels.add}
      </ContextMenuItem>
      <ContextMenuItem
        icon={SeparatorHorizontal}
        onClick={() => onAddSeparator(chapterId)}
      >
        Add Separator
      </ContextMenuItem>
      <ContextMenuItem
        icon={ArrowRightLeft}
        onClick={() => onMoveToOther(chapterId)}
      >
        {labels.moveToOther}
      </ContextMenuItem>
      {!isMenuDocument && (
        <ContextMenuItem
          icon={Settings}
          onClick={() => onOpenSeparatorSettings(chapterId)}
        >
          Separator Settings
        </ContextMenuItem>
      )}
      {isMenuDocument && (
        <>
          <ContextMenuItem icon={Download} onClick={() => onExport(chapterId)}>
            Export
          </ContextMenuItem>
          <ContextMenuItem
            icon={FileText}
            onClick={() => onEditSummary(chapterId)}
          >
            Edit Summary
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuLabel>Status</ContextMenuLabel>
          {STATUS_OPTIONS.map((opt) => {
            const isCurrent = chapter?.status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  isCurrent
                    ? "font-medium text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-700 dark:text-neutral-300"
                } hover:bg-neutral-100 dark:hover:bg-neutral-800`}
                onClick={() => onSetStatus(chapterId, opt.value)}
              >
                {isCurrent ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                {opt.label}
              </button>
            );
          })}
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={Trash2}
        variant="danger"
        onClick={() => onDelete(chapterId)}
      >
        Delete
      </ContextMenuItem>
    </ContextMenu>
  );
}
