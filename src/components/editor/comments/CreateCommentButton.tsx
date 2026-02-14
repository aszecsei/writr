"use client";

import type { Editor } from "@tiptap/react";
import { ChevronDown, MessageSquarePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createComment } from "@/db/operations";
import type { CommentColor } from "@/db/schemas";
import { useClickOutside } from "@/hooks/useClickOutside";
import { COLOR_BUTTON_CLASSES, COMMENT_COLORS } from "./colors";

interface CreateCommentButtonProps {
  editor: Editor | null;
  projectId: string;
  chapterId: string;
}

export function CreateCommentButton({
  editor,
  projectId,
  chapterId,
}: CreateCommentButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<CommentColor>("yellow");
  const menuRef = useRef<HTMLDivElement>(null);

  // Store last known selection so it survives focus loss when clicking button
  const selectionRef = useRef<{ from: number; to: number; empty: boolean }>({
    from: 1,
    to: 1,
    empty: true,
  });

  // Track editor selection changes
  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const { from, to, empty } = editor.state.selection;
      selectionRef.current = { from, to, empty };
    };

    updateSelection();
    editor.on("selectionUpdate", updateSelection);
    editor.on("transaction", updateSelection);
    return () => {
      editor.off("selectionUpdate", updateSelection);
      editor.off("transaction", updateSelection);
    };
  }, [editor]);

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  if (!editor) return null;

  const handleCreateComment = async () => {
    const { from, to } = selectionRef.current;

    // Extract anchor text from the ProseMirror document
    let anchorText = "";
    if (from !== to) {
      // Range selection - get the selected text
      anchorText = editor.state.doc.textBetween(from, to, "\n");
      // Truncate if too long
      if (anchorText.length > 100) {
        const half = 48;
        anchorText = `${anchorText.slice(0, half)}...${anchorText.slice(-half)}`;
      }
    } else {
      // Point comment - get surrounding context
      const contextStart = Math.max(1, from - 20);
      const contextEnd = Math.min(editor.state.doc.content.size, from + 20);
      anchorText = editor.state.doc.textBetween(contextStart, contextEnd, "\n");
    }

    await createComment({
      projectId,
      chapterId,
      fromOffset: from,
      toOffset: to,
      anchorText,
      color: selectedColor,
      content: "",
    });

    setMenuOpen(false);
    editor.commands.focus();
  };

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center">
        <button
          type="button"
          title="Add comment"
          onMouseDown={(e) => {
            // Prevent stealing focus from editor so selection survives
            e.preventDefault();
            handleCreateComment();
          }}
          className="rounded-l p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <MessageSquarePlus size={16} />
        </button>
        <button
          type="button"
          title="Choose color"
          onMouseDown={(e) => {
            e.preventDefault();
            setMenuOpen(!menuOpen);
          }}
          className="rounded-r border-l border-neutral-200 p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <ChevronDown size={12} />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-md border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          <div className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Color
          </div>
          <div className="flex gap-1.5">
            {COMMENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  setSelectedColor(color);
                }}
                className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                  COLOR_BUTTON_CLASSES[color]
                } ${
                  selectedColor === color
                    ? "ring-2 ring-neutral-900 ring-offset-1 dark:ring-white"
                    : ""
                }`}
                title={color.charAt(0).toUpperCase() + color.slice(1)}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleCreateComment();
            }}
            className="mt-2 w-full rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
          >
            Add Comment
          </button>
        </div>
      )}
    </div>
  );
}
