"use client";

import type { Extensions } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import {
  CommentMargin,
  CommentPopover,
  CommentsAdapterProvider,
  CreateCommentButton,
} from "@/components/editor/comments";
import { Comments } from "@/components/editor/extensions/Comments";
import type { ChapterId, Comment, ProjectId } from "@/db/schemas";
import { useCommentsAdapter } from "@/hooks/editor/useCommentsAdapter";
import { useEditorCommentSync } from "@/hooks/editor/useEditorCommentSync";

export interface CollabProseEditorProps {
  doc: Y.Doc;
  awareness: Awareness;
  editable: boolean;
  /** Display name surfaced over the user's caret. */
  userName?: string;
  /** Hex color for the caret + selection highlight. */
  userColor?: string;
  /**
   * Comments Y.Doc from the same session. When provided alongside
   * `chapterId` and `projectId`, the editor mounts the Comments extension
   * and surfaces inline highlights, the comment margin, and the popover.
   */
  commentsDoc?: Y.Doc;
  chapterId?: ChapterId;
  projectId?: ProjectId;
}

/**
 * TipTap editor bound to a shared Y.Doc + Awareness, with optional
 * collaborative comments. Used by the /shared/[uuid] guest route until
 * the host's ChapterEditor learns the same binding.
 */
export function CollabProseEditor(props: CollabProseEditorProps) {
  const {
    doc,
    awareness,
    editable,
    userName = "Guest",
    userColor = "#888888",
    commentsDoc,
    chapterId,
    projectId,
  } = props;

  // Comments TipTap extension reads its data through this ref. The
  // CommentsAdapter populates it via useEditorCommentSync below.
  const commentsRef = useRef<Comment[]>([]);
  const initializedRef = useRef(false);

  const commentsEnabled = !!(commentsDoc && chapterId && projectId);

  // Prose readiness: the comments adapter resolves Y.RelativePosition
  // anchors against the editor's PM state, which is meaningful only once
  // Yjs has finished its first sync into the editor. Until then,
  // resolution yields half-baked offsets that get baked into the Comments
  // plugin's positionMap and never recover (the plugin's
  // "keep tracked position" branch refuses to overwrite stale entries).
  // Collaboration.onFirstRender is the canonical signal that prose has
  // landed in the editor at least once.
  const [proseReady, setProseReady] = useState(false);
  // Reset on doc identity change — a fresh Y.Doc means a fresh sync. The
  // dep is the trigger; Biome's heuristic flags it as "unnecessary"
  // because the effect body doesn't read `doc`, but that's the point.
  // biome-ignore lint/correctness/useExhaustiveDependencies: doc identity is the intentional trigger
  useEffect(() => {
    setProseReady(false);
  }, [doc]);

  const extensions = useMemo<Extensions>(() => {
    const base: Extensions = [
      // Yjs ships its own history; disable StarterKit's so we don't
      // double-track or fight with remote updates.
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({
        document: doc,
        onFirstRender: () => setProseReady(true),
      }),
      CollaborationCaret.configure({
        // The caret extension only reads `provider.awareness`; we don't
        // need a full WebsocketProvider here because the CollabClient
        // already pumps awareness updates through to this instance.
        provider: { awareness },
        user: { name: userName, color: userColor },
      }),
    ];
    if (commentsEnabled) {
      base.push(Comments.configure({ commentsRef }));
    }
    return base;
  }, [doc, awareness, userName, userColor, commentsEnabled]);

  const editor = useEditor(
    {
      // Avoid SSR mismatches in the Next 16 client boundary.
      immediatelyRender: false,
      editable,
      extensions,
    },
    [extensions, editable],
  );

  // Mark "ready" once the editor exists so useEditorCommentSync will
  // dispatch COMMENTS_UPDATED_META and build comment decorations as
  // remote comments stream in.
  useEffect(() => {
    if (!editor) return;
    initializedRef.current = true;
  }, [editor]);

  if (!commentsEnabled || !editor) {
    return (
      <EditorContent
        editor={editor}
        className="prose prose-neutral max-w-none p-4 focus:outline-none dark:prose-invert"
      />
    );
  }

  // Hand the editor to the comments adapter only after Yjs has flushed
  // its first sync into PM. Before that, anchor resolution silently
  // returns the create-time fallback offset and pollutes the Comments
  // plugin's positionMap (which then refuses to overwrite).
  const editorForResolution = proseReady ? editor : null;

  return (
    <CommentEnabledBody
      editor={editor}
      editorForResolution={editorForResolution}
      commentsRef={commentsRef}
      initializedRef={initializedRef}
      projectId={projectId as ProjectId}
      chapterId={chapterId as ChapterId}
      userName={userName}
      userColor={userColor}
    />
  );
}

// Tailwind utility used by the host editor too — pulls editor width
// from the `--editor-content-width` CSS custom property defined in
// globals.css.
const CENTERED_COLUMN = "mx-auto px-8 max-w-editor";

interface CommentEnabledBodyProps {
  editor: Editor;
  /**
   * Editor used by the adapter to resolve `Y.RelativePosition` anchors.
   * Held back at `null` until Yjs has rendered into PM at least once
   * (`Collaboration.onFirstRender`), to avoid baking stale offsets into
   * the Comments plugin's positionMap.
   */
  editorForResolution: Editor | null;
  commentsRef: React.MutableRefObject<Comment[]>;
  initializedRef: React.MutableRefObject<boolean>;
  projectId: ProjectId;
  chapterId: ChapterId;
  userName: string;
  userColor: string;
}

/**
 * Split out so that the comments adapter (and the hooks it pulls in) is
 * only mounted when comments are actually wired up — keeps the disabled
 * path lean and snapshotable.
 */
function CommentEnabledBody({
  editor,
  editorForResolution,
  commentsRef,
  initializedRef,
  projectId,
  chapterId,
  userName,
  userColor,
}: CommentEnabledBodyProps) {
  const adapter = useCommentsAdapter({
    projectId,
    chapterId,
    editor: editorForResolution,
    authorName: userName,
    authorColor: userColor,
  });

  const { activeComments } = useEditorCommentSync(
    editor,
    adapter.comments,
    commentsRef,
    initializedRef,
  );

  // Layout mirrors the host's ChapterEditor: full-height column, a
  // narrow top toolbar, a `flex-1` scroll container with the prose
  // centered to a fixed editor width, and the CommentMargin / Popover
  // positioned absolutely off the same scroll container.
  return (
    <CommentsAdapterProvider adapter={adapter}>
      <div className="flex h-full flex-col">
        {adapter.canCreate && (
          <div className="flex items-center justify-end border-b border-neutral-200 bg-white px-2 py-1 dark:border-neutral-800 dark:bg-neutral-950">
            <CreateCommentButton editor={editor} />
          </div>
        )}
        <div className="relative flex-1 overflow-hidden">
          {/*
            `overflow-y-auto` here is load-bearing: CommentMargin /
            CommentPopover anchor positions to the closest scroll
            container with that class (see calculateCommentTop in
            comments/position.ts). The host's editor relies on the
            same selector.
          */}
          <div className="relative h-full overflow-y-auto">
            <div
              className={CENTERED_COLUMN}
              style={{ paddingTop: "1.5rem", paddingBottom: "1.5rem" }}
            >
              <EditorContent
                editor={editor}
                className="prose prose-neutral max-w-none focus:outline-none dark:prose-invert"
              />
            </div>
            <CommentMargin
              editor={editor}
              comments={activeComments}
              expanded={false}
            />
            <CommentPopover editor={editor} comments={activeComments} />
          </div>
        </div>
      </div>
    </CommentsAdapterProvider>
  );
}
