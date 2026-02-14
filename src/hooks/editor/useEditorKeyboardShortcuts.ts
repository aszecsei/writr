import { generateHTML } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { useEffect } from "react";
import { useUiStore } from "@/store/uiStore";

/** Registers keyboard shortcuts that require the editor instance (e.g. Ctrl+Shift+P for preview card). */
export function useEditorKeyboardShortcuts(
  editor: Editor | null,
  chapterTitle: string | undefined,
  projectTitle: string | undefined,
) {
  const openModal = useUiStore((s) => s.openModal);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault();
        if (!editor || editor.isDestroyed) return;

        const { from, to, empty } = editor.state.selection;
        if (empty) return;

        const slice = editor.state.doc.slice(from, to);
        const json = { type: "doc", content: slice.content.toJSON() };
        const selectedHtml = generateHTML(
          json,
          editor.extensionManager.extensions,
        );
        if (!selectedHtml.trim()) return;

        openModal({
          id: "preview-card",
          selectedHtml,
          projectTitle: projectTitle ?? "Untitled",
          chapterTitle: chapterTitle ?? "",
        });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, chapterTitle, projectTitle, openModal]);
}
