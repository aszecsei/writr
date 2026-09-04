"use client";

import type { Editor } from "@tiptap/react";
import { BookPlus, BookType, Eye } from "lucide-react";
import { useCallback } from "react";
import {
  addWordToAppDictionary,
  addWordToProjectDictionary,
} from "@/db/operations";
import type { ProjectId } from "@/db/schemas";
import {
  type ContextMenuState,
  useSpellcheckStore,
} from "@/store/spellcheckStore";
import { IssueContextMenu } from "./IssueContextMenu";

interface SpellcheckContextMenuProps {
  editor: Editor | null;
  projectId: ProjectId;
  contextMenu: ContextMenuState;
  onClose: () => void;
}

export function SpellcheckContextMenu({
  editor,
  projectId,
  contextMenu,
  onClose,
}: SpellcheckContextMenuProps) {
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
    addToIgnored(contextMenu.word.toLowerCase());
    await addWordToAppDictionary(contextMenu.word);
    onClose();
  }, [addToIgnored, contextMenu.word, onClose]);

  const handleAddToProjectDictionary = useCallback(async () => {
    addToIgnored(contextMenu.word.toLowerCase());
    await addWordToProjectDictionary(projectId, contextMenu.word);
    onClose();
  }, [addToIgnored, projectId, contextMenu.word, onClose]);

  const handleIgnore = useCallback(() => {
    addToIgnored(contextMenu.word.toLowerCase());
    onClose();
  }, [addToIgnored, contextMenu.word, onClose]);

  return (
    <IssueContextMenu
      anchorRect={contextMenu.rect}
      className="min-w-48"
      suggestions={contextMenu.suggestions.map((suggestion) => ({
        key: suggestion,
        label: suggestion,
        onSelect: () => handleSuggestionClick(suggestion),
      }))}
      actions={[
        {
          key: "app-dictionary",
          label: "Add to App Dictionary",
          icon: BookType,
          onClick: handleAddToAppDictionary,
        },
        {
          key: "project-dictionary",
          label: "Add to Project Dictionary",
          icon: BookPlus,
          onClick: handleAddToProjectDictionary,
        },
        {
          key: "ignore",
          label: "Ignore (this session)",
          icon: Eye,
          onClick: handleIgnore,
        },
      ]}
      onClose={onClose}
    />
  );
}
