import { Extension } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Mapping } from "@tiptap/pm/transform";
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

export const commentsPluginKey = new PluginKey<CommentsPluginState>("comments");

/** Metadata key used to signal that comments have changed. */
export const COMMENTS_UPDATED_META = "commentsUpdated";

interface CommentsPluginState {
  decorations: DecorationSet;
  positionMap: Map<string, { from: number; to: number }>;
}

/** Map all positions through a ProseMirror Mapping, clamping to valid range. */
export function mapPositions(
  oldMap: Map<string, { from: number; to: number }>,
  mapping: Mapping,
): Map<string, { from: number; to: number }> {
  const newMap = new Map<string, { from: number; to: number }>();
  for (const [id, { from, to }] of oldMap) {
    // assoc=1 for from (grows rightward), assoc=-1 for to (grows leftward)
    const newFrom = mapping.map(from, 1);
    const newTo = mapping.map(to, -1);
    // If to < from after mapping (content deleted), collapse to point
    newMap.set(id, { from: newFrom, to: Math.max(newFrom, newTo) });
  }
  return newMap;
}

/** Build decorations from a positionMap + comments array. */
function buildDecorationsFromMap(
  state: EditorState,
  positionMap: Map<string, { from: number; to: number }>,
  comments: Comment[],
): DecorationSet {
  if (positionMap.size === 0 && comments.length === 0) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];
  const docSize = state.doc.content.size;

  for (const comment of comments) {
    if (comment.status === "resolved") continue;

    const mapped = positionMap.get(comment.id);
    const rawFrom = mapped?.from ?? comment.fromOffset;
    const rawTo = mapped?.to ?? comment.toOffset;

    const from = Math.max(1, Math.min(rawFrom, docSize));
    const to = Math.max(1, Math.min(rawTo, docSize));

    if (from === to) {
      // Point comment - widget decoration
      decorations.push(
        Decoration.widget(
          from,
          () => {
            const el = document.createElement("span");
            el.className = `comment-marker ${MARKER_CLASSES[comment.color]}`;
            el.dataset.commentId = comment.id;
            el.setAttribute("aria-label", "Comment");
            return el;
          },
          { side: 0, key: comment.id },
        ),
      );
    } else if (from < to) {
      // Range comment - inline decoration
      decorations.push(
        Decoration.inline(from, to, {
          class: `comment-highlight ${HIGHLIGHT_CLASSES[comment.color]}`,
          "data-comment-id": comment.id,
        }),
      );
    }
  }

  if (decorations.length === 0) {
    return DecorationSet.empty;
  }

  return DecorationSet.create(state.doc, decorations);
}

/** Get the current position map from the editor state. */
export function getCommentPositions(
  state: EditorState,
): Map<string, { from: number; to: number }> {
  const pluginState = commentsPluginKey.getState(state);
  return pluginState?.positionMap ?? new Map();
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
          init(): CommentsPluginState {
            // Don't build decorations at init — the editor content
            // isn't loaded yet (setContent happens in a later effect).
            // The COMMENTS_UPDATED_META dispatch after content + comments
            // load will populate the positionMap and decorations.
            return {
              decorations: DecorationSet.empty,
              positionMap: new Map(),
            };
          },
          apply(tr, old, _oldState, newState): CommentsPluginState {
            const comments = commentsRef?.current ?? [];

            if (tr.getMeta(COMMENTS_UPDATED_META)) {
              // Comments changed from DB/liveQuery. Keep mapped positions
              // for existing comments, only use ref positions for NEW ones.
              const newMap = new Map<string, { from: number; to: number }>();
              const mappedOld = tr.docChanged
                ? mapPositions(old.positionMap, tr.mapping)
                : old.positionMap;

              for (const comment of comments) {
                if (comment.status === "resolved") continue;
                const existing = mappedOld.get(comment.id);
                if (existing) {
                  // Keep tracked position (prevents stale DB overwrite)
                  newMap.set(comment.id, existing);
                } else {
                  // New comment — use DB position
                  newMap.set(comment.id, {
                    from: comment.fromOffset,
                    to: comment.toOffset,
                  });
                }
              }

              const decorations = buildDecorationsFromMap(
                newState,
                newMap,
                comments,
              );
              return { decorations, positionMap: newMap };
            }

            if (tr.docChanged) {
              // Document changed — map all positions through the mapping.
              // If positionMap is empty (e.g. initial setContent), populate
              // from the comments ref so decorations appear immediately.
              let positionMap: Map<string, { from: number; to: number }>;
              if (old.positionMap.size === 0 && comments.length > 0) {
                positionMap = new Map();
                for (const comment of comments) {
                  if (comment.status === "resolved") continue;
                  positionMap.set(comment.id, {
                    from: comment.fromOffset,
                    to: comment.toOffset,
                  });
                }
              } else {
                positionMap = mapPositions(old.positionMap, tr.mapping);
              }
              const decorations = buildDecorationsFromMap(
                newState,
                positionMap,
                comments,
              );
              return { decorations, positionMap };
            }

            // No relevant changes
            return old;
          },
        },
        props: {
          decorations(state) {
            return (
              commentsPluginKey.getState(state)?.decorations ??
              DecorationSet.empty
            );
          },
        },
      }),
    ];
  },
});
