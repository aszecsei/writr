"use client";

import type { Editor } from "@tiptap/react";
import { Check, Pilcrow, Type } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { ToolbarButton } from "@/components/ui/ToolbarButton";
import { findLineBreakPairs } from "@/lib/normalize-line-breaks";
import { convertToSmartQuotes } from "@/lib/smart-quotes";

interface TextToolsMenuProps {
  editor: Editor | null;
}

export function TextToolsMenu({ editor }: TextToolsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [applied, setApplied] = useState(false);

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
      tr.replaceWith(
        r.from,
        r.to,
        editor.state.schema.text(r.replacement, r.marks),
      );
    }
    editor.view.dispatch(tr);

    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
    setMenuOpen(false);
  }

  function handleNormalizeLineBreaks() {
    if (!editor) return;

    const pairs = findLineBreakPairs(editor.state.doc);
    if (pairs.length === 0) {
      setMenuOpen(false);
      return;
    }

    // Apply all pair-splits in a single transaction (single undo step).
    // Process in reverse so earlier positions are unaffected by later edits.
    const tr = editor.state.tr;
    for (let i = pairs.length - 1; i >= 0; i--) {
      const { from, to } = pairs[i];
      tr.delete(from, to);
      tr.split(from);
    }
    editor.view.dispatch(tr);

    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
    setMenuOpen(false);
  }

  return (
    <DropdownMenu
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      panelClassName="w-44 rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
      trigger={
        <ToolbarButton
          icon={applied ? Check : Type}
          title="Text tools"
          onClick={() => setMenuOpen(!menuOpen)}
          variant={applied ? "success" : "default"}
        />
      }
    >
      <DropdownMenuItem icon={Type} onClick={handleSmartQuotes}>
        Smart Quotes
      </DropdownMenuItem>
      <DropdownMenuItem icon={Pilcrow} onClick={handleNormalizeLineBreaks}>
        Normalize Line Breaks
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
