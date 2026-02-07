"use client";

import type { Editor } from "@tiptap/react";
import { Check, Type } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { convertToSmartQuotes } from "@/lib/smart-quotes";

interface TextToolsMenuProps {
  editor: Editor | null;
}

export function TextToolsMenu({ editor }: TextToolsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  function handleSmartQuotes() {
    if (!editor) return;

    const replacements = convertToSmartQuotes(editor.state.doc);
    if (replacements.length === 0) {
      setMenuOpen(false);
      return;
    }

    // Apply all replacements in a single transaction (single undo step).
    // Apply in reverse order to preserve positions.
    const tr = editor.state.tr;
    for (let i = replacements.length - 1; i >= 0; i--) {
      const r = replacements[i];
      tr.replaceWith(r.from, r.to, editor.state.schema.text(r.replacement));
    }
    editor.view.dispatch(tr);

    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
    setMenuOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        title="Text tools"
        onClick={() => setMenuOpen(!menuOpen)}
        className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
          applied
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        }`}
      >
        {applied ? <Check size={16} /> : <Type size={16} />}
      </button>
      {menuOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          <button
            type="button"
            onClick={handleSmartQuotes}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            <Type size={14} />
            Smart Quotes
          </button>
        </div>
      )}
    </div>
  );
}
