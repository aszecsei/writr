"use no memo";
"use client";

import { type Editor, EditorContent, useEditor } from "@tiptap/react";
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
import { useEditorSpellcheck } from "@/hooks/editor/useEditorSpellcheck";
import { useFocusMode } from "@/hooks/editor/useFocusMode";
import {
  locateProposedEdit,
  spliceEdit,
} from "@/lib/ai/tool-calling/tools/edit-locator";
import { getEditorFont } from "@/lib/fonts";
import {
  fountainToProseMirror,
  parseFountain,
  serializeFountain,
} from "@/lib/fountain";
import {
  countWordsExcludingHoles,
  DEFAULT_HOLE_DELIMITERS,
  type HoleDelimiters,
} from "@/lib/holes";
import { getTerm } from "@/lib/terminology";
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
import { SCENE_TITLES_UPDATED_META } from "./extensions/SceneBreak";
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

// Word count for a serialized chapter string (markdown or fountain). Used when
// persisting a staged-edit splice, where the editor's live characterCount isn't
// available for the post-splice content (it's reseeded asynchronously). The
// next real editor save recomputes the authoritative count. Holes are excluded
// to match the live CharacterCount, which is configured the same way.
function countContentWords(text: string, delimiters: HoleDelimiters): number {
  return countWordsExcludingHoles(text, delimiters);
}

// Convert a markdown string into TipTap-compatible insertion content. Used
// by both the requestInsertAtCursor path (Spark inserts) and the
// requestStagedEdit path (propose_edit applies).
//
// Single-paragraph input returns inline text nodes so the splice stays
// inside the surrounding paragraph — wrapping inline content in a block
// paragraph splits the host paragraph in two, producing phantom \n\n on
// each side when the chapter round-trips to markdown. Multi-paragraph
// input returns block paragraph nodes; the splice deliberately splits the
// host paragraph, which is the intended outcome for multi-paragraph
// replacements. Inline marks (**bold** / *italic*) are not preserved — the
// LLM-generated inserts in practice are plain prose.
function markdownToInsertContent(markdown: string) {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length <= 1) {
    return paragraphs.map((text) => ({ type: "text", text }));
  }
  return paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  }));
}

/** Position of the sceneBreak marker carrying `sceneId`, or null if absent. */
function findSceneMarkerPos(editor: Editor, sceneId: string): number | null {
  let pos: number | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (
      pos === null &&
      node.type.name === "sceneBreak" &&
      node.attrs.sceneId === sceneId
    ) {
      pos = offset;
    }
  });
  return pos;
}

/** The nearest HTMLElement for a DOM node (itself if already an element). */
function elementFor(node: Node | null | undefined): HTMLElement | null {
  if (!node) return null;
  return node instanceof HTMLElement ? node : node.parentElement;
}

/**
 * Scroll the editor to a scene and place the caret at its start. Returns false
 * (a no-op) when the scene doesn't belong to this chapter's loaded rows — the
 * caller then leaves the scroll request pending for the right chapter's editor.
 * The core scene (no marker) scrolls to the top.
 *
 * Scrolls via the DOM `scrollIntoView` (not ProseMirror's transaction-level
 * scrollIntoView, which doesn't reliably walk the editor's nested overflow
 * containers), deferred a frame so it runs against post-seed layout.
 */
function scrollEditorToScene(
  editor: Editor,
  scenes: { id: string }[],
  targetId: string,
): boolean {
  if (!scenes.some((s) => s.id === targetId)) return false;
  const markerPos = findSceneMarkerPos(editor, targetId);
  const size = editor.state.doc.content.size;
  const caret = markerPos !== null ? markerPos + 1 : 1;
  // Move the caret to the scene start (drives the active-scene highlight).
  editor
    .chain()
    .setTextSelection(Math.max(1, Math.min(caret, size)))
    .run();
  requestAnimationFrame(() => {
    if (editor.isDestroyed) return;
    const target =
      markerPos !== null
        ? elementFor(editor.view.nodeDOM(markerPos))
        : elementFor(editor.view.domAtPos(1).node);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
  return true;
}

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
  // Latest values readable from the content-seed effect without making it a
  // dependency (which would wrongly reseed the doc when scenes change).
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const pendingSceneScrollRef = useRef(pendingSceneScroll);
  pendingSceneScrollRef.current = pendingSceneScroll;
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

  // Load content from Dexie into the editor once. In collab mode we only
  // seed the shared Y.Doc when it's empty; otherwise the relay's buffered
  // state has already been applied via the Collaboration extension.
  useEffect(() => {
    if (!editor || !chapter || editor.isDestroyed || initializedRef.current) {
      return;
    }
    if (collabDoc) {
      const isYDocEmpty = collabDoc.getXmlFragment("default").length === 0;
      if (isYDocEmpty && (chapter.content || "").length > 0) {
        if (isScreenplay) {
          const elements = parseFountain(chapter.content || "");
          const json = fountainToProseMirror(elements);
          editor.commands.setContent(json);
        } else {
          editor.commands.setContent(chapter.content || "");
        }
      }
      // If the Y.Doc has content we leave it alone — peers' state wins.
    } else if (isScreenplay) {
      const elements = parseFountain(chapter.content || "");
      const json = fountainToProseMirror(elements);
      editor.commands.setContent(json);
    } else {
      editor.commands.setContent(chapter.content || "");
    }
    const wc = getWordCount(editor.storage);
    setWordCount(wc);
    initializedRef.current = true;
    // Consume a pending scene-scroll now that the doc is seeded — this is the
    // path that fires after cross-chapter navigation. Same-chapter clicks are
    // handled by the dedicated effect below.
    const pending = pendingSceneScrollRef.current;
    if (
      pending &&
      scenesRef.current &&
      scrollEditorToScene(editor, scenesRef.current, pending)
    ) {
      clearSceneScroll();
    }
  }, [
    editor,
    chapter,
    setWordCount,
    isScreenplay,
    collabDoc,
    clearSceneScroll,
  ]);

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

  // Reset initialized flag when chapterId, contentVersion, or collab mode
  // changes — entering or leaving a session needs a fresh seed pass.
  const contentVersion = useEditorStore((s) => s.contentVersion);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on chapterId/contentVersion/collab change
  useEffect(() => {
    initializedRef.current = false;
    resetReconcile();
  }, [chapterId, contentVersion, resetReconcile, isCollabHost]);

  // Auto-save
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

  // Keep scene-break labels in sync with live scene data. Untitled scenes fall
  // back to a positional "Scene N" label matching the binder/details panels
  // (scenes are order-sorted, so the array index is the scene number). Keyed on
  // a title signature so word-count churn (which also mutates `scenes`) doesn't
  // trigger needless decoration rebuilds. The ref is read by the SceneBreak
  // plugin; a meta-only dispatch rebuilds its label decorations without marking
  // the editor dirty. A mode switch recreates the editor, refreshing the term.
  const sceneTitlesKey = useMemo(
    () => (scenes ?? []).map((s) => `${s.id}\u0000${s.title}`).join("\n"),
    [scenes],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: sceneTitlesKey is the intentional trigger; the map is rebuilt from the latest scenesRef
  useEffect(() => {
    const sceneTerm = getTerm(activeProjectMode, "scene");
    sceneTitlesRef.current = new Map(
      (scenesRef.current ?? []).map((s, index) => [
        s.id,
        s.title.trim() || `${sceneTerm} ${index + 1}`,
      ]),
    );
    if (editor && !editor.isDestroyed) {
      editor.view.dispatch(
        editor.state.tr.setMeta(SCENE_TITLES_UPDATED_META, true),
      );
    }
  }, [editor, sceneTitlesKey]);

  // Scroll to a scene requested from a sidebar. Handles the same-chapter case
  // (editor already seeded); cross-chapter scrolls are consumed by the seed
  // effect after navigation.
  useEffect(() => {
    if (
      !pendingSceneScroll ||
      !editor ||
      editor.isDestroyed ||
      !initializedRef.current
    ) {
      return;
    }
    if (scrollEditorToScene(editor, scenes ?? [], pendingSceneScroll)) {
      clearSceneScroll();
    }
  }, [pendingSceneScroll, editor, scenes, clearSceneScroll]);

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
        if (!isCollabHostRef.current) {
          const positions = getCommentPositions(ed.state);
          if (positions.size > 0) {
            updateCommentPositions(positions);
          }
        }
      }
    };
  }, []);

  // Focus mode: focus editor and scroll to center cursor
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useFocusMode(focusModeEnabled, editor, scrollContainerRef);

  // AI-driven inserts: the AiPanel posts markdown via editorStore. Apply at
  // the requested range (selection-replace) or current cursor, then clear.
  const pendingInsertion = useEditorStore((s) => s.pendingInsertion);
  const clearPendingInsertion = useEditorStore((s) => s.clearPendingInsertion);
  useEffect(() => {
    if (!pendingInsertion || !editor || editor.isDestroyed) return;
    const { markdown, replaceRange } = pendingInsertion;
    const nodes = markdownToInsertContent(markdown);

    const chain = editor.chain().focus();
    if (replaceRange) {
      chain.insertContentAt(
        { from: replaceRange.from, to: replaceRange.to },
        nodes,
      );
    } else {
      const { from } = editor.state.selection;
      chain.insertContentAt(from, nodes);
    }
    chain.run();
    clearPendingInsertion();
  }, [pendingInsertion, editor, clearPendingInsertion]);

  // AI-driven staged edits: the AiPanel posts an edit when the user clicks
  // Apply on a propose_edit diff card. The panel has no editor access, so we
  // resolve and apply here. Resolution runs against the chapter's serialized
  // STRING (the same representation propose_edit validated its anchor against)
  // via the shared `locateProposedEdit` — not the flattened PM doc, which
  // strips markdown and silently dropped any anchor touching formatting. We
  // splice the string, persist, then `bumpContentVersion` to reseed the editor
  // (re-parsing fountain when needed) and re-anchor comments through the normal
  // reconcile path. The originating card observes the outcome via
  // `reportStagedEditResult`.
  const pendingStagedEdit = useEditorStore((s) => s.pendingStagedEdit);
  const clearPendingStagedEdit = useEditorStore(
    (s) => s.clearPendingStagedEdit,
  );
  useEffect(() => {
    if (!pendingStagedEdit || !editor || editor.isDestroyed) return;
    if (pendingStagedEdit.chapterId !== chapterId) return;
    const edit = pendingStagedEdit;

    const content = isScreenplay
      ? serializeFountain(editor.state.doc)
      : getMarkdown(editor.storage);
    const range = locateProposedEdit(content, edit);

    if (!range) {
      console.warn(
        `[propose_edit] anchorText not located in chapter — staged ${edit.kind} edit dropped`,
      );
      reportStagedEditResult(edit.editId, "failed");
      clearPendingStagedEdit();
      return;
    }

    const next = spliceEdit(content, range, edit.newContent);
    clearPendingStagedEdit();
    // Cancel any pending autosave before persisting. A debounced autosave armed
    // by recent typing would read the editor doc — which still holds the
    // pre-splice content until the async reseed below — and clobber our write.
    // Marking saved clears that timer; our apply never re-dirties the doc, so no
    // new autosave starts before the reseed.
    markSaved();
    void (async () => {
      await updateChapterContent(
        chapterId,
        next,
        countContentWords(next, holeDelimitersRef.current),
      );
      bumpContentVersion();
      reportStagedEditResult(edit.editId, "applied");
    })();
  }, [
    pendingStagedEdit,
    editor,
    chapterId,
    isScreenplay,
    reportStagedEditResult,
    clearPendingStagedEdit,
    markSaved,
    bumpContentVersion,
  ]);

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
