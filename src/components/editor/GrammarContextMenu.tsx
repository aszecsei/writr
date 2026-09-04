"use client";

import type { Editor } from "@tiptap/react";
import { Ban, EyeOff } from "lucide-react";
import { useCallback } from "react";
import { setGrammarRuleEnabled } from "@/db/operations";
import { ignoreKey } from "@/lib/grammar";
import {
  type GrammarContextMenuState,
  useGrammarStore,
} from "@/store/grammarStore";
import { IssueContextMenu } from "./IssueContextMenu";

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
  const addToIgnored = useGrammarStore((s) => s.addToIgnored);
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
    addToIgnored(ignoreKey(result.kind, result.problemText));
    onClose();
  }, [addToIgnored, result.kind, result.problemText, onClose]);

  const handleDisableRule = useCallback(() => {
    void setGrammarRuleEnabled(result.ruleKey, false);
    onClose();
  }, [result.ruleKey, onClose]);

  return (
    <IssueContextMenu
      anchorRect={contextMenu.rect}
      className="min-w-56 max-w-xs"
      message={result.message}
      suggestions={result.suggestions.map((suggestion) => ({
        key: `${suggestion.label}:${suggestion.replacement}`,
        label: suggestion.label,
        onSelect: () => handleApply(suggestion.replacement),
      }))}
      actions={[
        {
          key: "ignore",
          label: "Ignore (this session)",
          icon: EyeOff,
          onClick: handleIgnore,
        },
        ...(result.ruleKey
          ? [
              {
                key: "disable-rule",
                label: "Disable this rule",
                icon: Ban,
                onClick: handleDisableRule,
              },
            ]
          : []),
      ]}
      onClose={onClose}
    />
  );
}
