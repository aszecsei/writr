"use no memo";
"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { updateChapterContent, updateCommentPositions } from "@/db/operations";
import type { ChapterId, Comment, ProjectId, SceneId } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useChapter } from "@/hooks/data/useChapter";
import { useScenesByChapter } from "@/hooks/data/useScene";
import { useAutoSave } from "@/hooks/editor/useAutoSave";
import { useCommentsAdapter } from "@/hooks/editor/useCommentsAdapter";
import { useEditorCommentSync } from "@/hooks/editor/useEditorCommentSync";
import { useEditorGrammar } from "@/hooks/editor/useEditorGrammar";
import { useEditorKeyboardShortcuts } from "@/hooks/editor/useEditorKeyboardShortcuts";
import { useEditorPendingInsertion } from "@/hooks/editor/useEditorPendingInsertion";
import { useEditorSeed } from "@/hooks/editor/useEditorSeed";
import { useEditorSpellcheck } from "@/hooks/editor/useEditorSpellcheck";
import { useFocusMode } from "@/hooks/editor/useFocusMode";
import { useSceneTitleSync } from "@/hooks/editor/useSceneTitleSync";
import { useStagedEdits } from "@/hooks/editor/useStagedEdits";
import { getMarkdown, getWordCount } from "@/lib/editor/tiptap-storage";
import { getEditorFont } from "@/lib/fonts";
import { serializeFountain } from "@/lib/fountain";
import { DEFAULT_HOLE_DELIMITERS, type HoleDelimiters } from "@/lib/holes";
import { useCollabStore } from "@/store/collabStore";
import { useCommentStore } from "@/store/commentStore";
import { useEditorStore } from "@/store/editorStore";
import { useFindReplaceStore } from "@/store/findReplaceStore";
import { useGrammarStore } from "@/store/grammarStore";
import { useProjectStore } from "@/store/projectStore";
import { useSpellcheckStore } from "@/store/spellcheckStore";
import { useUiStore } from "@/store/uiStore";
import {
  CommentMargin,
  CommentPopover,
  CommentsAdapterProvider,
} from "./comments";
import { EditorToolbar } from "./EditorToolbar";
import { createExtensions, createScreenplayExtensions } from "./extensions";
import { getCommentPositions } from "./extensions/Comments";
import { GRAMMAR_UPDATED_META } from "./extensions/Grammar";
import { HOLES_UPDATED_META } from "./extensions/Holes";
import { SENTENCE_LENGTH_PREVIEW_META } from "./extensions/SentenceLengthPreview";
import { SPELLCHECK_UPDATED_META } from "./extensions/Spellcheck";
import { FindReplacePanel } from "./FindReplacePanel";
import { GrammarContextMenu } from "./GrammarContextMenu";
import { GrammarScannerModal } from "./GrammarScannerModal";
import { ScreenplayToolbar } from "./ScreenplayToolbar";
import { SpellcheckContextMenu } from "./SpellcheckContextMenu";
import { SpellcheckScannerModal } from "./SpellcheckScannerModal";
import {
  activeSceneAt,
  ensureSceneIds,
  reconcileSceneRows,
} from "./scene-sync";

interface ChapterEditorProps {
  chapterId: ChapterId;
}

export function ChapterEditor({ chapterId }: ChapterEditorProps) {
  const chapter = useChapter(chapterId);
  const scenes = useScenesByChapter(chapterId);
  const settings = useAppSettings();
  const editorFont = getEditorFont(settings?.editorFont ?? "literata");
  const setActiveDocument = useEditorStore((s) => s.setActiveDocument);
  const clearActiveDocument = useEditorStore((s) => s.clearActiveDocument);
  const markDirty = useEditorStore((s) => s.markDirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const bumpContentVersion = useEditorStore((s) => s.bumpContentVersion);
  const setWordCount = useEditorStore((s) => s.setWordCount);
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const setActiveSceneId = useEditorStore((s) => s.setActiveSceneId);
  const pendingSceneScroll = useEditorStore((s) => s.pendingSceneScroll);
  const clearSceneScroll = useEditorStore((s) => s.clearSceneScroll);
  const reportStagedEditResult = useEditorStore(
    (s) => s.reportStagedEditResult,
  );
  const focusModeEnabled = useUiStore((s) => s.focusModeEnabled);
  const sentenceLengthPreviewEnabled = useUiStore(
    (s) => s.sentenceLengthPreviewEnabled,
  );
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectTitle = useProjectStore((s) => s.activeProjectTitle);
  const activeProjectMode = useProjectStore((s) => s.activeProjectMode);
  const isScreenplay = activeProjectMode === "screenplay";
  const marginVisible = useCommentStore((s) => s.marginVisible);
  const closeFindReplace = useFindReplaceStore((s) => s.close);
  const contextMenu = useSpellcheckStore((s) => s.contextMenu);
  const closeContextMenu = useSpellcheckStore((s) => s.closeContextMenu);
  const grammarContextMenu = useGrammarStore((s) => s.contextMenu);
  const closeGrammarContextMenu = useGrammarStore((s) => s.closeContextMenu);
  const initializedRef = useRef(false);

  // Host-side collab binding. The /shared/[uuid] guest path uses
  // CollabProseEditor; ChapterEditor is the host's local view of the
  // chapter, so we only flip into collab mode when role is "host".
  const collabSession = useCollabStore((s) => s.session);
  const collabRole = useCollabStore((s) => s.role);
  const collabIdentity = useCollabStore((s) => s.identity);
  const isCollabHost = collabSession !== null && collabRole === "host";
  const collabDoc = isCollabHost ? collabSession.getDoc("prose") : null;
  const collabAwareness = isCollabHost ? collabSession.awareness : null;

  // Ref for typewriter scrolling - allows dynamic toggling without recreating editor
  const typewriterScrollingRef = useRef(false);
  typewriterScrollingRef.current = focusModeEnabled;

  // Ref for the sentence-length preview toggle — same dynamic-toggle pattern;
  // a SENTENCE_LENGTH_PREVIEW_META dispatch below applies the flip.
  const sentenceLengthPreviewRef = useRef(false);
  sentenceLengthPreviewRef.current = sentenceLengthPreviewEnabled;

  // Ref for comments - allows dynamic updates without recreating editor
  const commentsRef = useRef<Comment[]>([]);

  // Ref for scene-break labels: sceneId → title. Titles live in Dexie, not in
  // the marker node, so the SceneBreak plugin reads them here without the
  // editor being recreated. A SCENE_TITLES_UPDATED_META dispatch rebuilds the
  // label decorations when a title changes.
  const sceneTitlesRef = useRef<Map<string, string>>(new Map());

  // Ref for hole delimiters - lets the Holes extension and CharacterCount read
  // the latest setting without recreating the editor (a HOLES_UPDATED_META
  // dispatch rebuilds decorations when the setting changes).
  const holeDelimitersRef = useRef<HoleDelimiters>(DEFAULT_HOLE_DELIMITERS);
  holeDelimitersRef.current =
    settings?.holeDelimiters ?? DEFAULT_HOLE_DELIMITERS;

  // Prose readiness gate: the comments adapter resolves Y.RelativePosition
  // anchors against the editor's PM state, which is meaningful only once
  // Yjs has flushed its first sync into the editor. Until then, anchor
  // encoding falls back to the end of the (empty) fragment and gets
  // baked into the Comments plugin's positionMap (which then refuses to
  // overwrite). Mirror the guest's gate in CollabProseEditor.tsx.
  const [proseReady, setProseReady] = useState(false);
  // Reset on collab doc identity change — a fresh Y.Doc means a fresh sync.
  // biome-ignore lint/correctness/useExhaustiveDependencies: collabDoc identity is the intentional trigger
  useEffect(() => {
    setProseReady(false);
  }, [collabDoc]);
  const onProseFirstRender = useCallback(() => setProseReady(true), []);

  // Spellcheck setup
  const {
    spellcheckerRef,
    customWordsRef,
    spellcheckEnabledRef,
    ignoredWordsRef,
    onSpellcheckContextMenu,
    spellcheckVersion,
  } = useEditorSpellcheck(activeProjectId);

  // Grammar setup (harper.js). Enabled state is persisted in AppSettings.
  const {
    grammarServiceRef,
    grammarEnabledRef,
    ignoredLintsRef,
    onGrammarContextMenu,
    grammarVersion,
  } = useEditorGrammar();

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
    const opts: Parameters<typeof createExtensions>[0] = {
      typewriterScrollingRef,
      sentenceLengthPreviewRef,
      commentsRef,
      holeDelimitersRef,
      spellcheckerRef,
      customWordsRef,
      spellcheckEnabledRef,
      ignoredWordsRef,
      onSpellcheckContextMenu,
      grammarServiceRef,
      grammarEnabledRef,
      ignoredLintsRef,
      onGrammarContextMenu,
      onSelectionChange,
      onSelectionClear,
      sceneTitlesRef,
    };
    if (collabDoc && collabAwareness) {
      opts.collab = {
        doc: collabDoc,
        awareness: collabAwareness,
        userName: collabIdentity?.name ?? "Host",
        userColor: collabIdentity?.color ?? "#10b981",
        onFirstRender: onProseFirstRender,
      };
    }
    return isScreenplay
      ? createScreenplayExtensions(opts)
      : createExtensions(opts);
  }, [
    isScreenplay,
    collabDoc,
    collabAwareness,
    collabIdentity,
    onProseFirstRender,
  ]);

  // Recreate the editor whenever the extension set changes (e.g., toggling
  // collab mode or switching between prose / screenplay).
  const editor = useEditor(
    {
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
    },
    [extensions],
  );

  // Hand the editor to the comments adapter only after Yjs has flushed
  // its first sync into PM. Before that, anchor encoding produces stale
  // offsets that pollute the Comments plugin's positionMap (which refuses
  // to overwrite once seeded). Solo mode passes the editor straight through.
  const editorForComments = isCollabHost
    ? proseReady
      ? editor
      : null
    : editor;

  // Comments adapter (Dexie when solo; Yjs-backed during a host session)
  const commentsAdapter = useCommentsAdapter({
    projectId: (activeProjectId ?? "") as ProjectId,
    chapterId,
    editor: editorForComments,
  });

  // Comment synchronization (ref sync + reconciliation)
  const { activeComments, resetReconcile } = useEditorCommentSync(
    editor,
    commentsAdapter.comments,
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

  // Trigger grammar decoration rebuild when grammar state changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: grammarVersion tracks all grammar state changes
  useEffect(() => {
    if (editor && !editor.isDestroyed && initializedRef.current) {
      const tr = editor.state.tr.setMeta(GRAMMAR_UPDATED_META, true);
      editor.view.dispatch(tr);
    }
  }, [editor, grammarVersion]);

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

  const contentVersion = useEditorStore((s) => s.contentVersion);

  // Seed the doc from Dexie/collab, reset the seed flag on chapter/version/
  // collab-mode change, and consume pending sidebar scene-scroll requests.
  useEditorSeed({
    editor,
    chapter,
    chapterId,
    isScreenplay,
    collabDoc,
    isCollabHost,
    contentVersion,
    scenes,
    pendingSceneScroll,
    clearSceneScroll,
    setWordCount,
    initializedRef,
    resetReconcile,
  });

  // When the hole delimiters change, rebuild hole decorations and refresh the
  // live word count (a meta-only transaction doesn't fire onUpdate, so the
  // footer count is updated manually here). The ref already holds the new value.
  const holeOpen = settings?.holeDelimiters.open;
  const holeClose = settings?.holeDelimiters.close;
  // biome-ignore lint/correctness/useExhaustiveDependencies: holeOpen/holeClose are the intentional triggers; the effect reads the latest values via holeDelimitersRef
  useEffect(() => {
    if (!editor || editor.isDestroyed || !initializedRef.current) return;
    editor.view.dispatch(editor.state.tr.setMeta(HOLES_UPDATED_META, true));
    setWordCount(getWordCount(editor.storage));
  }, [editor, holeOpen, holeClose, setWordCount]);

  // When the preview toggle flips, rebuild (or clear) sentence-length
  // decorations. The extension reads the new value via sentenceLengthPreviewRef.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sentenceLengthPreviewEnabled is the intentional trigger; the effect reads the latest value via sentenceLengthPreviewRef
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(SENTENCE_LENGTH_PREVIEW_META, true),
    );
  }, [editor, sentenceLengthPreviewEnabled]);

  // Auto-save (also flushes a final save on unmount)
  const isScreenplayRef = useRef(isScreenplay);
  isScreenplayRef.current = isScreenplay;

  // In collab mode the YjsCommentsAdapter is the source of truth for
  // comment positions (anchors are CRDT-anchored relative positions). We
  // skip the legacy PM-mapping writeback to Dexie so the two systems
  // don't fight over fromOffset/toOffset.
  const isCollabHostRef = useRef(isCollabHost);
  isCollabHostRef.current = isCollabHost;

  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;

  const save = useCallback(async () => {
    if (!editor || editor.isDestroyed) return;
    const isScreenplayNow = isScreenplayRef.current;
    // Prose Model-D scenes: resolve any null/duplicate marker ids into the doc
    // BEFORE serializing, so the persisted content carries unique real ids.
    if (!isScreenplayNow) {
      ensureSceneIds(editor, () => crypto.randomUUID());
    }
    const content = isScreenplayNow
      ? serializeFountain(editor.state.doc)
      : getMarkdown(editor.storage);
    const wordCount = getWordCount(editor.storage);
    await updateChapterContent(chapterId, content, wordCount);
    // Reconcile Scene rows against the document's markers and write derived
    // per-scene word counts. Prose only — screenplay has no scene breaks.
    if (!isScreenplayNow && activeProjectIdRef.current) {
      await reconcileSceneRows(
        editor,
        chapterId,
        activeProjectIdRef.current as ProjectId,
        holeDelimitersRef.current,
      );
    }
    if (!isCollabHostRef.current) {
      const positions = getCommentPositions(editor.state);
      if (positions.size > 0) {
        await updateCommentPositions(positions);
      }
    }
  }, [editor, chapterId]);

  useAutoSave(save);

  // Track which scene the caret sits in so the Details panel binds to the
  // "current" scene. Recomputes on selection/content change and whenever the
  // chapter's scene rows change. `scenes` is sorted by order, so its ids are
  // [coreId, ...markerIds] — the ordering activeSceneAt indexes into.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const ids = (scenes ?? []).map((s) => s.id);
    const update = () => {
      setActiveSceneId((activeSceneAt(editor, ids) as SceneId | null) ?? null);
    };
    update();
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor, scenes, setActiveSceneId]);

  // Keep scene-break labels in sync with live scene data.
  useSceneTitleSync({
    editor,
    scenes,
    activeProjectMode,
    sceneTitlesRef,
  });

  // Focus mode: focus editor and scroll to center cursor
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useFocusMode(focusModeEnabled, editor, scrollContainerRef);

  // AI-driven inserts: the AiPanel posts markdown via editorStore.
  const pendingInsertion = useEditorStore((s) => s.pendingInsertion);
  const clearPendingInsertion = useEditorStore((s) => s.clearPendingInsertion);
  useEditorPendingInsertion({
    editor,
    pendingInsertion,
    clearPendingInsertion,
  });

  // AI-driven staged edits: applies a propose_edit diff card's Apply click.
  const pendingStagedEdit = useEditorStore((s) => s.pendingStagedEdit);
  const clearPendingStagedEdit = useEditorStore(
    (s) => s.clearPendingStagedEdit,
  );
  useStagedEdits({
    editor,
    chapterId,
    isScreenplay,
    pendingStagedEdit,
    clearPendingStagedEdit,
    reportStagedEditResult,
    markSaved,
    bumpContentVersion,
    holeDelimitersRef,
  });

  // Keyboard shortcuts (Ctrl+Shift+P for preview card)
  useEditorKeyboardShortcuts(
    editor,
    chapter?.title,
    activeProjectTitle ?? undefined,
  );

  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Separators are structural markers, not editable documents. Reachable only
  // via a stale/direct URL — the binder opens their settings dialog instead.
  if (chapter.kind === "separator") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-sm text-neutral-500 dark:text-neutral-400">
          This is a separator, not an editable document. Use its settings in the
          binder to change the label or compile options.
        </p>
      </div>
    );
  }

  return (
    <CommentsAdapterProvider adapter={commentsAdapter}>
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
        {grammarContextMenu && (
          <GrammarContextMenu
            editor={editor}
            contextMenu={grammarContextMenu}
            onClose={closeGrammarContextMenu}
          />
        )}
        <GrammarScannerModal editor={editor} />
      </div>
    </CommentsAdapterProvider>
  );
}
