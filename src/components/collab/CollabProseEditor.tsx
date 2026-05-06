"use client";

import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";

export interface CollabProseEditorProps {
  doc: Y.Doc;
  awareness: Awareness;
  editable: boolean;
  /** Display name surfaced over the user's caret. */
  userName?: string;
  /** Hex color for the caret + selection highlight. */
  userColor?: string;
}

/**
 * Minimal TipTap editor bound to a shared Y.Doc + Awareness. Used by
 * the guest route until the host's ChapterEditor learns the same
 * binding. No markdown round-trip, no comments, no spellcheck —
 * intentionally a focused surface that exercises the encrypted
 * relay end-to-end.
 */
export function CollabProseEditor({
  doc,
  awareness,
  editable,
  userName = "Guest",
  userColor = "#888888",
}: CollabProseEditorProps) {
  const editor = useEditor(
    {
      // Avoid SSR mismatches in the Next 16 client boundary.
      immediatelyRender: false,
      editable,
      extensions: [
        // Yjs ships its own history; disable StarterKit's so we don't
        // double-track or fight with remote updates.
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: doc }),
        CollaborationCaret.configure({
          // The caret extension only reads `provider.awareness`; we don't
          // need a full WebsocketProvider here because the CollabClient
          // already pumps awareness updates through to this instance.
          provider: { awareness },
          user: { name: userName, color: userColor },
        }),
      ],
    },
    [doc, awareness, editable],
  );

  return (
    <EditorContent
      editor={editor}
      className="prose prose-neutral max-w-none p-4 focus:outline-none dark:prose-invert"
    />
  );
}
