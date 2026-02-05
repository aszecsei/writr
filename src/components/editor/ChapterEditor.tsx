"use no memo";
"use client";

import { generateHTML } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { updateChapterContent, updateComment } from "@/db/operations";
import type { Comment } from "@/db/schemas";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useChapter } from "@/hooks/useChapter";
import { useCommentsByChapter } from "@/hooks/useComments";
import { reconcileComment } from "@/lib/comments/reconcile";
import { getEditorFont } from "@/lib/fonts";
import { useCommentStore } from "@/store/commentStore";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { CommentMargin, CommentPopover } from "./comments";
import { EditorToolbar } from "./EditorToolbar";
import { createExtensions } from "./extensions";
import { COMMENTS_UPDATED_META } from "./extensions/Comments";

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
  const comments = useCommentsByChapter(chapterId);
  const settings = useAppSettings();
  const editorFont = getEditorFont(settings?.editorFont ?? "literata");
  const setActiveDocument = useEditorStore((s) => s.setActiveDocument);
  const clearActiveDocument = useEditorStore((s) => s.clearActiveDocument);
  const markDirty = useEditorStore((s) => s.markDirty);
  const setWordCount = useEditorStore((s) => s.setWordCount);
  const focusModeEnabled = useUiStore((s) => s.focusModeEnabled);
  const openModal = useUiStore((s) => s.openModal);
  const activeProjectTitle = useProjectStore((s) => s.activeProjectTitle);
  const marginVisible = useCommentStore((s) => s.marginVisible);
  const initializedRef = useRef(false);
  const reconcileRunRef = useRef(false);

  // Ref for typewriter scrolling - allows dynamic toggling without recreating editor
  const typewriterScrollingRef = useRef(false);
  typewriterScrollingRef.current = focusModeEnabled;

  // Ref for comments - allows dynamic updates without recreating editor
  const commentsRef = useRef<Comment[]>([]);

  // Filter to active/orphaned comments (not resolved)
  const activeComments = useMemo(() => {
    const filtered = (comments ?? []).filter((c) => c.status !== "resolved");
    return filtered;
  }, [comments]);

  // Memoize extensions to prevent recreation on every render
  const extensions = useMemo(
    () => createExtensions({ typewriterScrollingRef, commentsRef }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      markDirty();
      const wc = getWordCount(e.storage);
      setWordCount(wc);
    },
  });

  // Update the comments ref and force ProseMirror to re-render decorations
  useEffect(() => {
    commentsRef.current = activeComments;
    if (editor && !editor.isDestroyed) {
      // Dispatch a transaction with metadata to trigger decoration rebuild
      const tr = editor.state.tr.setMeta(COMMENTS_UPDATED_META, true);
      editor.view.dispatch(tr);
    }
  }, [activeComments, editor]);

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
    reconcileRunRef.current = false;
  }, [chapterId]);

  // Reconcile comment positions on chapter load
  useEffect(() => {
    if (
      !editor ||
      editor.isDestroyed ||
      !comments ||
      !initializedRef.current ||
      reconcileRunRef.current
    )
      return;
    reconcileRunRef.current = true;

    const doc = editor.state.doc;
    const plainText = doc.textBetween(1, doc.content.size, "\n");

    for (const comment of comments) {
      if (comment.status === "resolved") continue;

      const result = reconcileComment(comment, plainText);

      if (!result.found) {
        if (comment.status !== "orphaned") {
          updateComment(comment.id, { status: "orphaned" });
        }
      } else if (result.newFrom !== undefined && result.newTo !== undefined) {
        updateComment(comment.id, {
          fromOffset: result.newFrom,
          toOffset: result.newTo,
          status: "active",
        });
      } else if (comment.status === "orphaned") {
        updateComment(comment.id, { status: "active" });
      }
    }
  }, [editor, comments]);

  // Auto-save
  const save = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;
    const markdown = getMarkdown(editor.storage);
    const wordCount = getWordCount(editor.storage);
    await updateChapterContent(chapterId, markdown, wordCount);
  }, [editor, chapterId]);

  useAutoSave(save);

  // Save on unmount to preserve content when toggling focus mode
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const chapterIdRef = useRef(chapterId);
  chapterIdRef.current = chapterId;

  useEffect(() => {
    return () => {
      const ed = editorRef.current;
      if (ed && !ed.isDestroyed) {
        const markdown = getMarkdown(ed.storage);
        const wc = getWordCount(ed.storage);
        // Fire-and-forget save on unmount
        updateChapterContent(chapterIdRef.current, markdown, wc);
      }
    };
  }, []);

  // Focus editor and scroll to center cursor when entering focus mode
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusModeEnabled || !editor || editor.isDestroyed) return;

    const focusAndScroll = () => {
      if (editor.isDestroyed || !scrollContainerRef.current) return;

      // Focus the editor so user can start typing immediately
      editor.commands.focus();

      // Scroll to center the cursor
      const view = editor.view;
      const { from } = view.state.selection;
      const coords = view.coordsAtPos(from);
      const container = scrollContainerRef.current;

      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.height / 2;
      const cursorOffsetInContainer =
        coords.top - containerRect.top + container.scrollTop;
      const targetScroll = cursorOffsetInContainer - containerCenter;

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "instant",
      });
    };

    // Focus after fullscreen transition completes
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        // Just entered fullscreen, focus the editor
        setTimeout(focusAndScroll, 50);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Also try immediately in case fullscreen already happened or isn't available
    const timeoutId = setTimeout(focusAndScroll, 100);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      clearTimeout(timeoutId);
    };
  }, [focusModeEnabled, editor]);

  // Keyboard shortcut for preview card (Ctrl+Shift+P)
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
          projectTitle: activeProjectTitle ?? "Untitled",
          chapterTitle: chapter?.title ?? "",
        });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, chapter, activeProjectTitle, openModal]);

  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {!focusModeEnabled && <EditorToolbar editor={editor} />}
      <div ref={scrollContainerRef} className="relative flex-1 overflow-y-auto">
        <div
          className="mx-auto max-w-3xl px-8"
          style={{
            // Add top/bottom padding in focus mode to allow cursor to always be centered
            paddingTop: focusModeEnabled ? "50vh" : "1.5rem",
            paddingBottom: focusModeEnabled ? "50vh" : "1.5rem",
          }}
        >
          <EditorContent
            editor={editor}
            className="prose prose-zinc dark:prose-invert max-w-none"
            style={{ fontFamily: editorFont.cssFamily }}
          />
        </div>
        {!focusModeEnabled && (
          <CommentMargin
            editor={editor}
            comments={activeComments}
            expanded={marginVisible}
          />
        )}
        {!focusModeEnabled && !marginVisible && (
          <CommentPopover editor={editor} comments={activeComments} />
        )}
      </div>
    </div>
  );
}
