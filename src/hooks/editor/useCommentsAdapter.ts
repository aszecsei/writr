import type { Editor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/db/database";
import type { ChapterId, Comment, ProjectId } from "@/db/schemas";
import {
  type DexieMirror,
  YjsCommentsAdapter,
  type YjsCommentsPermissions,
} from "@/lib/collab/comments";
import type { CommentsAdapter } from "@/lib/comments/adapter";
import { DexieCommentsAdapter } from "@/lib/comments/dexie-adapter";
import { useCollabStore } from "@/store/collabStore";
import { useCommentsByChapter } from "./useComments";

export interface UseCommentsAdapterOptions {
  projectId: ProjectId;
  chapterId: ChapterId;
  /**
   * The bound TipTap editor. Used by the Yjs adapter to map Y.RelativePosition
   * back to absolute PM offsets. Null is acceptable while the editor is
   * initializing — the adapter falls back to captured initial offsets.
   */
  editor: Editor | null;
  /**
   * Display name + color stamped onto comments this peer authors.
   * Defaults are used when omitted (host: "Host" / green; guest: "Guest" / grey).
   */
  authorName?: string;
  authorColor?: string;
}

const FULL_PERMS: YjsCommentsPermissions = {
  canCreate: true,
  canEdit: true,
  canResolve: true,
  canDelete: true,
};

const READONLY_PERMS: YjsCommentsPermissions = {
  canCreate: false,
  canEdit: false,
  canResolve: false,
  canDelete: false,
};

const HOST_DEFAULT_NAME = "Host";
const HOST_DEFAULT_COLOR = "#10b981";
const GUEST_DEFAULT_NAME = "Guest";
const GUEST_DEFAULT_COLOR = "#888888";

const dexieMirror: DexieMirror = {
  async upsert(comment: Comment) {
    await db.comments.put(comment);
  },
  async remove(id) {
    await db.comments.delete(id);
  },
};

/**
 * Picks a CommentsAdapter based on collab session state.
 * - Solo / no session → DexieCommentsAdapter (today's behavior).
 * - Collab session → YjsCommentsAdapter (host mirrors mutations to Dexie).
 */
export function useCommentsAdapter(
  opts: UseCommentsAdapterOptions,
): CommentsAdapter {
  const { projectId, chapterId, editor } = opts;
  const session = useCollabStore((s) => s.session);
  const role = useCollabStore((s) => s.role);
  const identity = useCollabStore((s) => s.identity);

  const dexieComments = useCommentsByChapter(chapterId);

  const inSession = session !== null && role !== null;
  const isHost = role === "host";
  const canEditComments =
    role === "host" || role === "edit" || role === "review";

  // Yjs branch state — the adapter is a long-lived object, not a memo,
  // because it owns observer subscriptions and editor late-binding.
  const [yjsTick, setYjsTick] = useState(0);
  const yjsRef = useRef<YjsCommentsAdapter | null>(null);

  // (Re)create the Yjs adapter on session/role/chapter change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberately do not depend on `editor` — late-bound via setEditor()
  useEffect(() => {
    if (!inSession || !session) {
      if (yjsRef.current) {
        yjsRef.current.destroy();
        yjsRef.current = null;
      }
      return;
    }
    const commentsDoc = session.getDoc("comments");
    const permissions = canEditComments ? FULL_PERMS : READONLY_PERMS;
    const adapter = new YjsCommentsAdapter({
      commentsDoc,
      editor,
      chapterId,
      projectId,
      permissions,
      author:
        opts.authorName ??
        identity?.name ??
        (isHost ? HOST_DEFAULT_NAME : GUEST_DEFAULT_NAME),
      authorColor:
        opts.authorColor ??
        identity?.color ??
        (isHost ? HOST_DEFAULT_COLOR : GUEST_DEFAULT_COLOR),
      onChange: () => setYjsTick((t) => t + 1),
      dexieMirror: isHost ? dexieMirror : undefined,
    });
    yjsRef.current = adapter;
    setYjsTick((t) => t + 1);

    if (isHost) {
      adapter.writeMeta(chapterId, projectId);
    }

    return () => {
      adapter.destroy();
      if (yjsRef.current === adapter) {
        yjsRef.current = null;
      }
    };
  }, [
    inSession,
    session,
    isHost,
    canEditComments,
    chapterId,
    projectId,
    opts.authorName,
    opts.authorColor,
    identity,
  ]);

  // Late-bind editor reference to the Yjs adapter so anchors resolve.
  useEffect(() => {
    yjsRef.current?.setEditor(editor);
  }, [editor]);

  // Host-side seeding from Dexie. Runs once per session, after the editor
  // has bound (so we can compute Y.RelativePosition for each anchor).
  const seededRef = useRef<{ session: unknown; chapter: string } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: yjsTick re-fires this effect after the adapter is created in the previous effect; refs aren't reactive so we depend on the tick instead
  useEffect(() => {
    if (!isHost) {
      seededRef.current = null;
      return;
    }
    const adapter = yjsRef.current;
    if (!adapter || !editor || dexieComments === undefined) return;
    const seedKey = { session, chapter: chapterId };
    const last = seededRef.current;
    if (
      last &&
      last.session === seedKey.session &&
      last.chapter === seedKey.chapter
    ) {
      return;
    }
    adapter.seedFromDexie(dexieComments);
    seededRef.current = seedKey;
  }, [isHost, editor, dexieComments, session, chapterId, yjsTick]);

  // Solo branch — fresh adapter per render is fine; it's a thin wrapper.
  const dexieAdapter = useMemo(
    () =>
      new DexieCommentsAdapter({
        projectId,
        chapterId,
        comments: dexieComments ?? [],
      }),
    [projectId, chapterId, dexieComments],
  );

  // Tick the read so consumers re-render when the Yjs snapshot changes.
  void yjsTick;

  if (inSession && session && yjsRef.current) {
    return yjsRef.current;
  }
  return dexieAdapter;
}
