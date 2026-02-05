import { Extension } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Comment, CommentColor } from "@/db/schemas";

export interface CommentsOptions {
  commentsRef: { current: Comment[] } | undefined;
}

const HIGHLIGHT_CLASSES: Record<CommentColor, string> = {
  yellow: "comment-highlight-yellow",
  blue: "comment-highlight-blue",
  green: "comment-highlight-green",
  red: "comment-highlight-red",
  purple: "comment-highlight-purple",
};

const MARKER_CLASSES: Record<CommentColor, string> = {
  yellow: "comment-marker-yellow",
  blue: "comment-marker-blue",
  green: "comment-marker-green",
  red: "comment-marker-red",
  purple: "comment-marker-purple",
};

export const commentsPluginKey = new PluginKey("comments");

/** Metadata key used to signal that comments have changed. */
export const COMMENTS_UPDATED_META = "commentsUpdated";

function buildDecorations(
  state: EditorState,
  comments: Comment[],
): DecorationSet {
  if (!comments || comments.length === 0) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];
  const docSize = state.doc.content.size;

  for (const comment of comments) {
    if (comment.status === "resolved") continue;

    const { fromOffset, toOffset, color, id } = comment;

    // Offsets are stored as ProseMirror positions
    const from = Math.max(1, Math.min(fromOffset, docSize));
    const to = Math.max(1, Math.min(toOffset, docSize));

    if (from === to) {
      // Point comment - widget decoration
      decorations.push(
        Decoration.widget(
          from,
          () => {
            const el = document.createElement("span");
            el.className = `comment-marker ${MARKER_CLASSES[color]}`;
            el.dataset.commentId = id;
            el.setAttribute("aria-label", "Comment");
            return el;
          },
          { side: 0, key: id },
        ),
      );
    } else if (from < to) {
      // Range comment - inline decoration
      decorations.push(
        Decoration.inline(from, to, {
          class: `comment-highlight ${HIGHLIGHT_CLASSES[color]}`,
          "data-comment-id": id,
        }),
      );
    }
  }

  if (decorations.length === 0) {
    return DecorationSet.empty;
  }

  return DecorationSet.create(state.doc, decorations);
}

export const Comments = Extension.create<CommentsOptions>({
  name: "comments",

  addOptions() {
    return {
      commentsRef: undefined as { current: Comment[] } | undefined,
    };
  },

  addProseMirrorPlugins() {
    const { commentsRef } = this.options;

    return [
      new Plugin({
        key: commentsPluginKey,
        state: {
          init(_, state) {
            return buildDecorations(state, commentsRef?.current ?? []);
          },
          apply(tr, oldDecorations, _oldState, newState) {
            // Rebuild decorations when comments are updated or document changes
            if (tr.getMeta(COMMENTS_UPDATED_META) || tr.docChanged) {
              return buildDecorations(newState, commentsRef?.current ?? []);
            }
            // Map existing decorations through document changes
            return oldDecorations.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return commentsPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
