"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FilePlus,
  Link2,
  Link2Off,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";
import type { Chapter, OutlineCardColor } from "@/db/schemas";

const COLORS: { value: OutlineCardColor; label: string; className: string }[] =
  [
    {
      value: "white",
      label: "White",
      className: "bg-white border border-neutral-300",
    },
    { value: "yellow", label: "Yellow", className: "bg-amber-200" },
    { value: "pink", label: "Pink", className: "bg-pink-200" },
    { value: "blue", label: "Blue", className: "bg-sky-200" },
    { value: "green", label: "Green", className: "bg-emerald-200" },
    { value: "orange", label: "Orange", className: "bg-orange-200" },
    { value: "purple", label: "Purple", className: "bg-violet-200" },
  ];

export type ContextMenuTarget =
  | { type: "cell"; rowId: string; columnId: string }
  | { type: "row"; rowId: string; linkedChapterId: string | null }
  | { type: "column"; columnId: string };

interface OutlineGridContextMenuProps {
  position: { x: number; y: number };
  target: ContextMenuTarget;
  currentColor?: OutlineCardColor;
  availableChapters?: Chapter[];
  onClose: () => void;
  onInsertRowAbove: () => void;
  onInsertRowBelow: () => void;
  onInsertColumnLeft: () => void;
  onInsertColumnRight: () => void;
  onDeleteRow: () => void;
  onDeleteColumn: () => void;
  onRenameColumn: () => void;
  onSetColor: (color: OutlineCardColor) => void;
  onLinkChapter: (chapterId: string) => void;
  onUnlinkChapter: () => void;
  onCreateChapter: () => void;
}

export function OutlineGridContextMenu({
  position,
  target,
  currentColor,
  availableChapters,
  onClose,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColumnLeft,
  onInsertColumnRight,
  onDeleteRow,
  onDeleteColumn,
  onRenameColumn,
  onSetColor,
  onLinkChapter,
  onUnlinkChapter,
  onCreateChapter,
}: OutlineGridContextMenuProps) {
  const showRowActions = target.type === "cell" || target.type === "row";
  const showColumnActions = target.type === "cell" || target.type === "column";
  const showColorPicker = target.type === "cell";
  const showChapterLinking = target.type === "row";
  const isLinkedToChapter =
    target.type === "row" && target.linkedChapterId !== null;

  return (
    <ContextMenu position={position} onClose={onClose}>
      {showRowActions && (
        <>
          <ContextMenuItem icon={ArrowUp} onClick={onInsertRowAbove}>
            Insert row above
          </ContextMenuItem>
          <ContextMenuItem icon={ArrowDown} onClick={onInsertRowBelow}>
            Insert row below
          </ContextMenuItem>
          <ContextMenuItem icon={Trash2} variant="danger" onClick={onDeleteRow}>
            Delete row
          </ContextMenuItem>
        </>
      )}

      {showChapterLinking && (
        <>
          <ContextMenuSeparator />
          {isLinkedToChapter ? (
            <ContextMenuItem icon={Link2Off} onClick={onUnlinkChapter}>
              Unlink from chapter
            </ContextMenuItem>
          ) : (
            <>
              <ContextMenuItem
                icon={FilePlus}
                onClick={() => {
                  onCreateChapter();
                  onClose();
                }}
              >
                Create chapter from row
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuLabel>Link to chapter</ContextMenuLabel>
              {availableChapters && availableChapters.length > 0 ? (
                <div className="max-h-40 overflow-y-auto">
                  {availableChapters.map((chapter) => (
                    <ContextMenuItem
                      key={chapter.id}
                      icon={Link2}
                      onClick={() => {
                        onLinkChapter(chapter.id);
                        onClose();
                      }}
                    >
                      <span className="truncate">{chapter.title}</span>
                    </ContextMenuItem>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-1.5 text-sm text-neutral-400">
                  No chapters available
                </div>
              )}
            </>
          )}
        </>
      )}

      {showRowActions && showColumnActions && <ContextMenuSeparator />}

      {showColumnActions && (
        <>
          <ContextMenuItem icon={ArrowLeft} onClick={onInsertColumnLeft}>
            Insert column left
          </ContextMenuItem>
          <ContextMenuItem icon={ArrowRight} onClick={onInsertColumnRight}>
            Insert column right
          </ContextMenuItem>
          {target.type === "column" && (
            <ContextMenuItem icon={Pencil} onClick={onRenameColumn}>
              Rename column
            </ContextMenuItem>
          )}
          <ContextMenuItem
            icon={Trash2}
            variant="danger"
            onClick={onDeleteColumn}
          >
            Delete column
          </ContextMenuItem>
        </>
      )}

      {showColorPicker && (
        <>
          <ContextMenuSeparator />
          <ContextMenuLabel>Cell color</ContextMenuLabel>
          <div className="flex gap-1 px-3 py-1.5">
            {COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`h-5 w-5 rounded-sm ${color.className} ${
                  currentColor === color.value
                    ? "ring-2 ring-neutral-400 ring-offset-1"
                    : ""
                }`}
                onClick={() => {
                  onSetColor(color.value);
                  onClose();
                }}
                title={color.label}
              />
            ))}
          </div>
        </>
      )}
    </ContextMenu>
  );
}
