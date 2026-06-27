"use client";

import type { Editor } from "@tiptap/react";
import { Ban, EyeOff } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { setGrammarRuleEnabled } from "@/db/operations";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  type GrammarContextMenuState,
  useGrammarStore,
} from "@/store/grammarStore";

interface GrammarContextMenuProps {
  editor: Editor | null;
  contextMenu: GrammarContextMenuState;
  onClose: () => void;
}

export function GrammarContextMenu({
  editor,
  contextMenu,
  onClose,
}: GrammarContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const ignoreLint = useGrammarStore((s) => s.ignoreLint);
  const { result } = contextMenu;

  const handleApply = useCallback(
    (replacement: string) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: result.from, to: result.to }, replacement)
        .run();
      onClose();
    },
    [editor, result, onClose],
  );

  const handleIgnore = useCallback(() => {
    ignoreLint(result.kind, result.problemText);
    onClose();
  }, [ignoreLint, result.kind, result.problemText, onClose]);

  const handleDisableRule = useCallback(() => {
    void setGrammarRuleEnabled(result.ruleKey, false);
    onClose();
  }, [result.ruleKey, onClose]);

  useClickOutside(menuRef, onClose);

  const style = {
    position: "fixed" as const,
    top: contextMenu.rect.bottom + 4,
    left: contextMenu.rect.left,
    zIndex: 50,
  };

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: adjustPosition reads contextMenu.rect internally
  useEffect(() => {
    adjustPosition();
  }, [contextMenu.rect]);

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="min-w-56 max-w-xs rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    >
      {/* Explanation of why the text was flagged */}
      <div className="px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        {result.message}
      </div>
      <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />

      {/* Suggestions */}
      {result.suggestions.length > 0 ? (
        <>
          {result.suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.label}:${suggestion.replacement}`}
              type="button"
              onClick={() => handleApply(suggestion.replacement)}
              className="flex w-full items-center px-3 py-1.5 text-left text-sm text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              <span className="mr-2 text-xs text-neutral-400">{index + 1}</span>
              {suggestion.label}
            </button>
          ))}
          <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
        </>
      ) : (
        <>
          <div className="px-3 py-1.5 text-sm italic text-neutral-500">
            No suggestions
          </div>
          <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
        </>
      )}

      <button
        type="button"
        onClick={handleIgnore}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
      >
        <EyeOff size={14} className="text-neutral-500" />
        Ignore (this session)
      </button>
      {result.ruleKey && (
        <button
          type="button"
          onClick={handleDisableRule}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          <Ban size={14} className="text-neutral-500" />
          Disable this rule
        </button>
      )}
    </div>,
    document.body,
  );
}
