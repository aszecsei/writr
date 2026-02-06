"use client";

import type { Editor } from "@tiptap/react";
import { BookPlus, BookType, Eye } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  addWordToAppDictionary,
  addWordToProjectDictionary,
} from "@/db/operations";
import {
  type ContextMenuState,
  useSpellcheckStore,
} from "@/store/spellcheckStore";

interface SpellcheckContextMenuProps {
  editor: Editor | null;
  projectId: string;
  contextMenu: ContextMenuState;
  onClose: () => void;
}

export function SpellcheckContextMenu({
  editor,
  projectId,
  contextMenu,
  onClose,
}: SpellcheckContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const addToIgnored = useSpellcheckStore((s) => s.addToIgnored);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContentAt(
          { from: contextMenu.from, to: contextMenu.to },
          suggestion,
        )
        .run();
      onClose();
    },
    [editor, contextMenu, onClose],
  );

  const handleAddToAppDictionary = useCallback(async () => {
    await addWordToAppDictionary(contextMenu.word);
    onClose();
  }, [contextMenu.word, onClose]);

  const handleAddToProjectDictionary = useCallback(async () => {
    await addWordToProjectDictionary(projectId, contextMenu.word);
    onClose();
  }, [projectId, contextMenu.word, onClose]);

  const handleIgnore = useCallback(() => {
    addToIgnored(contextMenu.word);
    onClose();
  }, [addToIgnored, contextMenu.word, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Position the menu
  const style = {
    position: "fixed" as const,
    top: contextMenu.rect.bottom + 4,
    left: contextMenu.rect.left,
    zIndex: 50,
  };

  // Adjust if menu would go off-screen
  const adjustPosition = () => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth) {
      menuRef.current.style.left = `${viewportWidth - rect.width - 8}px`;
    }
    if (rect.bottom > viewportHeight) {
      menuRef.current.style.top = `${contextMenu.rect.top - rect.height - 4}px`;
    }
  };

  useEffect(() => {
    adjustPosition();
  });

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="min-w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
    >
      {/* Suggestions */}
      {contextMenu.suggestions.length > 0 && (
        <>
          {contextMenu.suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="flex w-full items-center px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              <span className="mr-2 text-xs text-zinc-400">{index + 1}</span>
              {suggestion}
            </button>
          ))}
          <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        </>
      )}

      {/* No suggestions message */}
      {contextMenu.suggestions.length === 0 && (
        <>
          <div className="px-3 py-1.5 text-sm italic text-zinc-500">
            No suggestions
          </div>
          <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        </>
      )}

      {/* Dictionary actions */}
      <button
        type="button"
        onClick={handleAddToAppDictionary}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
      >
        <BookType size={14} className="text-zinc-500" />
        Add to App Dictionary
      </button>
      <button
        type="button"
        onClick={handleAddToProjectDictionary}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
      >
        <BookPlus size={14} className="text-zinc-500" />
        Add to Project Dictionary
      </button>
      <button
        type="button"
        onClick={handleIgnore}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700"
      >
        <Eye size={14} className="text-zinc-500" />
        Ignore (this session)
      </button>
    </div>,
    document.body,
  );
}
