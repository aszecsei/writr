"use no memo";
"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef } from "react";
import { updateChapterContent } from "@/db/operations";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useChapter } from "@/hooks/useChapter";
import { getEditorFont } from "@/lib/fonts";
import { useEditorStore } from "@/store/editorStore";
import { EditorToolbar } from "./EditorToolbar";
import { createExtensions } from "./extensions";

// tiptap-markdown and character-count store methods on editor.storage
// but TipTap's Storage type doesn't expose them, so we cast through unknown
interface MarkdownStorage {
  getMarkdown: () => string;
}
interface CharacterCountStorage {
  words: () => number;
}
function getMarkdown(storage: unknown): string {
  return (storage as { markdown: MarkdownStorage }).markdown.getMarkdown();
}
function getWordCount(storage: unknown): number {
  return (
    storage as { characterCount: CharacterCountStorage }
  ).characterCount.words();
}

interface ChapterEditorProps {
  chapterId: string;
}

export function ChapterEditor({ chapterId }: ChapterEditorProps) {
  const chapter = useChapter(chapterId);
  const settings = useAppSettings();
  const editorFont = getEditorFont(settings?.editorFont ?? "literata");
  const setActiveDocument = useEditorStore((s) => s.setActiveDocument);
  const clearActiveDocument = useEditorStore((s) => s.clearActiveDocument);
  const markDirty = useEditorStore((s) => s.markDirty);
  const setWordCount = useEditorStore((s) => s.setWordCount);
  const initializedRef = useRef(false);

  const editor = useEditor({
    extensions: createExtensions(),
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      markDirty();
      const wc = getWordCount(e.storage);
      setWordCount(wc);
    },
  });

  // Set active document on mount
  useEffect(() => {
    setActiveDocument(chapterId, "chapter");
    return () => {
      clearActiveDocument();
    };
  }, [chapterId, setActiveDocument, clearActiveDocument]);

  // Load content from Dexie into the editor once
  useEffect(() => {
    if (editor && chapter && !editor.isDestroyed && !initializedRef.current) {
      editor.commands.setContent(chapter.content || "");
      const wc = getWordCount(editor.storage);
      setWordCount(wc);
      initializedRef.current = true;
    }
  }, [editor, chapter, setWordCount]);

  // Reset initialized flag when chapterId changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on chapterId change
  useEffect(() => {
    initializedRef.current = false;
  }, [chapterId]);

  // Auto-save
  const save = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;
    const markdown = getMarkdown(editor.storage);
    const wordCount = getWordCount(editor.storage);
    await updateChapterContent(chapterId, markdown, wordCount);
  }, [editor, chapterId]);

  useAutoSave(save);

  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-6">
          <EditorContent
            editor={editor}
            className="prose prose-zinc dark:prose-invert max-w-none"
            style={{ fontFamily: editorFont.cssFamily }}
          />
        </div>
      </div>
    </div>
  );
}
