"use no memo";
"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { updateChapterContent, updateCommentPositions } from "@/db/operations";
import type { Comment } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useChapter } from "@/hooks/data/useChapter";
import { useAutoSave } from "@/hooks/editor/useAutoSave";
import { useCommentsByChapter } from "@/hooks/editor/useComments";
import { useEditorCommentSync } from "@/hooks/editor/useEditorCommentSync";
import { useEditorKeyboardShortcuts } from "@/hooks/editor/useEditorKeyboardShortcuts";
import { useEditorSpellcheck } from "@/hooks/editor/useEditorSpellcheck";
import { useFocusMode } from "@/hooks/editor/useFocusMode";
import { getEditorFont } from "@/lib/fonts";
import {
  fountainToProseMirror,
  parseFountain,
  serializeFountain,
} from "@/lib/fountain";
import { useCommentStore } from "@/store/commentStore";
import { useEditorStore } from "@/store/editorStore";
import { useFindReplaceStore } from "@/store/findReplaceStore";
import { useProjectStore } from "@/store/projectStore";
import { useSpellcheckStore } from "@/store/spellcheckStore";
import { useUiStore } from "@/store/uiStore";
import { CommentMargin, CommentPopover } from "./comments";
import { EditorToolbar } from "./EditorToolbar";
import { createExtensions, createScreenplayExtensions } from "./extensions";
import { getCommentPositions } from "./extensions/Comments";
import { SPELLCHECK_UPDATED_META } from "./extensions/Spellcheck";
import { FindReplacePanel } from "./FindReplacePanel";
import { ScreenplayToolbar } from "./ScreenplayToolbar";
import { SpellcheckContextMenu } from "./SpellcheckContextMenu";
import { SpellcheckScannerModal } from "./SpellcheckScannerModal";

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
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const focusModeEnabled = useUiStore((s) => s.focusModeEnabled);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectTitle = useProjectStore((s) => s.activeProjectTitle);
  const activeProjectMode = useProjectStore((s) => s.activeProjectMode);
  const isScreenplay = activeProjectMode === "screenplay";
  const marginVisible = useCommentStore((s) => s.marginVisible);
  const closeFindReplace = useFindReplaceStore((s) => s.close);
  const contextMenu = useSpellcheckStore((s) => s.contextMenu);
  const closeContextMenu = useSpellcheckStore((s) => s.closeContextMenu);
  const initializedRef = useRef(false);

  // Ref for typewriter scrolling - allows dynamic toggling without recreating editor
  const typewriterScrollingRef = useRef(false);
  typewriterScrollingRef.current = focusModeEnabled;

  // Ref for comments - allows dynamic updates without recreating editor
  const commentsRef = useRef<Comment[]>([]);

  // Spellcheck setup
  const {
    spellcheckerRef,
    customWordsRef,
    spellcheckEnabledRef,
    ignoredWordsRef,
    onSpellcheckContextMenu,
    spellcheckVersion,
  } = useEditorSpellcheck(activeProjectId);

  // Stable callback refs for selection preserver
  const setSelectionRef = useRef(setSelection);
  setSelectionRef.current = setSelection;
  const clearSelectionRef = useRef(clearSelection);
  clearSelectionRef.current = clearSelection;

  const onSelectionChange = useCallback(
    (text: string, from: number, to: number) => {
      setSelectionRef.current(text, from, to);
    },
    [],
  );
  const onSelectionClear = useCallback(() => {
    clearSelectionRef.current();
  }, []);

  // Memoize extensions to prevent recreation on every render
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs and stable callbacks intentionally omitted to prevent editor recreation
  const extensions = useMemo(() => {
    const opts = {
      typewriterScrollingRef,
      commentsRef,
      spellcheckerRef,
      customWordsRef,
      spellcheckEnabledRef,
      ignoredWordsRef,
      onSpellcheckContextMenu,
      onSelectionChange,
      onSelectionClear,
    };
    return isScreenplay
      ? createScreenplayExtensions(opts)
      : createExtensions(opts);
  }, [isScreenplay]);

  const editor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        spellcheck: "false",
      },
    },
    onUpdate: ({ editor: e }) => {
      markDirty();
      const wc = getWordCount(e.storage);
      setWordCount(wc);
    },
  });

  // Comment synchronization (ref sync + reconciliation)
  const { activeComments, resetReconcile } = useEditorCommentSync(
    editor,
    comments,
    commentsRef,
    initializedRef,
  );

  // Trigger spellcheck decoration rebuild when spellcheck state changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: spellcheckVersion tracks all spellcheck state changes
  useEffect(() => {
    if (editor && !editor.isDestroyed && initializedRef.current) {
      const tr = editor.state.tr.setMeta(SPELLCHECK_UPDATED_META, true);
      editor.view.dispatch(tr);
    }
  }, [editor, spellcheckVersion]);

  // Set active document on mount
  useEffect(() => {
    setActiveDocument(chapterId, "chapter");
    return () => {
      clearActiveDocument();
    };
  }, [chapterId, setActiveDocument, clearActiveDocument]);

  // Close find/replace panel when chapter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: chapterId intentionally triggers close on chapter switch
  useEffect(() => {
    closeFindReplace();
  }, [chapterId, closeFindReplace]);

  // Load content from Dexie into the editor once
  useEffect(() => {
    if (editor && chapter && !editor.isDestroyed && !initializedRef.current) {
      if (isScreenplay) {
        const elements = parseFountain(chapter.content || "");
        const json = fountainToProseMirror(elements);
        editor.commands.setContent(json);
      } else {
        editor.commands.setContent(chapter.content || "");
      }
      const wc = getWordCount(editor.storage);
      setWordCount(wc);
      initializedRef.current = true;
    }
  }, [editor, chapter, setWordCount, isScreenplay]);

  // Reset initialized flag when chapterId changes or content is restored
  const contentVersion = useEditorStore((s) => s.contentVersion);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on chapterId/contentVersion change
  useEffect(() => {
    initializedRef.current = false;
    resetReconcile();
  }, [chapterId, contentVersion, resetReconcile]);

  // Auto-save
  const isScreenplayRef = useRef(isScreenplay);
  isScreenplayRef.current = isScreenplay;

  const save = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;
    const content = isScreenplayRef.current
      ? serializeFountain(editor.state.doc)
      : getMarkdown(editor.storage);
    const wordCount = getWordCount(editor.storage);
    await updateChapterContent(chapterId, content, wordCount);
    const positions = getCommentPositions(editor.state);
    if (positions.size > 0) {
      await updateCommentPositions(positions);
    }
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
        const content = isScreenplayRef.current
          ? serializeFountain(ed.state.doc)
          : getMarkdown(ed.storage);
        const wc = getWordCount(ed.storage);
        updateChapterContent(chapterIdRef.current, content, wc);
        const positions = getCommentPositions(ed.state);
        if (positions.size > 0) {
          updateCommentPositions(positions);
        }
      }
    };
  }, []);

  // Focus mode: focus editor and scroll to center cursor
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useFocusMode(focusModeEnabled, editor, scrollContainerRef);

  // Keyboard shortcuts (Ctrl+Shift+P for preview card)
  useEditorKeyboardShortcuts(
    editor,
    chapter?.title,
    activeProjectTitle ?? undefined,
  );

  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600 dark:border-neutral-700 dark:border-t-primary-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {!focusModeEnabled &&
        (isScreenplay ? (
          <ScreenplayToolbar editor={editor} />
        ) : (
          <EditorToolbar editor={editor} />
        ))}
      <div className="relative flex-1 overflow-hidden">
        {!focusModeEnabled && <FindReplacePanel editor={editor} />}
        <div
          ref={scrollContainerRef}
          className="relative h-full overflow-y-auto"
        >
          <div
            className={`mx-auto px-8 ${isScreenplay ? "" : "max-w-editor"}`}
            style={{
              paddingTop: focusModeEnabled ? "50vh" : "1.5rem",
              paddingBottom: focusModeEnabled ? "50vh" : "1.5rem",
            }}
          >
            <EditorContent
              editor={editor}
              className={
                isScreenplay
                  ? "screenplay-editor"
                  : "prose prose-neutral dark:prose-invert max-w-none"
              }
              style={
                isScreenplay
                  ? undefined
                  : {
                      fontFamily: editorFont.cssFamily,
                      fontSize: `${settings?.editorFontSize ?? 16}px`,
                    }
              }
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
      {contextMenu && activeProjectId && (
        <SpellcheckContextMenu
          editor={editor}
          projectId={activeProjectId}
          contextMenu={contextMenu}
          onClose={closeContextMenu}
        />
      )}
      {activeProjectId && (
        <SpellcheckScannerModal editor={editor} projectId={activeProjectId} />
      )}
    </div>
  );
}
