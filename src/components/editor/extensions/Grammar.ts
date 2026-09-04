import { Extension } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { GrammarResult, GrammarService } from "@/lib/grammar";

export interface GrammarOptions {
  grammarServiceRef: { current: GrammarService | null } | undefined;
  enabledRef: { current: boolean } | undefined;
  ignoredRef: { current: Set<string> } | undefined;
  onContextMenu?: (result: GrammarResult, rect: DOMRect) => void;
}

const grammarPluginKey = new PluginKey<GrammarPluginState>("grammar");

/** Metadata key used to signal that grammar checking should rebuild. */
export const GRAMMAR_UPDATED_META = "grammarUpdated";

/** Metadata key for delivering async grammar results. */
const GRAMMAR_RESULTS_META = "grammarResults";

interface GrammarPluginState {
  decorations: DecorationSet;
  results: GrammarResult[];
}

/** Stash the result index on the decoration so the context menu can recover it. */
function buildDecorations(
  results: GrammarResult[],
  doc: Parameters<typeof DecorationSet.create>[0],
): DecorationSet {
  if (results.length === 0) {
    return DecorationSet.empty;
  }

  const decorations = results.map((result, index) =>
    Decoration.inline(result.from, result.to, {
      class: "grammar-error",
      "data-grammar-index": String(index),
    }),
  );

  return DecorationSet.create(doc, decorations);
}

/**
 * Debounce delay for typing (ms). Longer than spellcheck because a grammar pass
 * reasons over whole sentences and runs in a worker round-trip.
 */
const TYPING_DEBOUNCE = 500;

/**
 * Grammar-checking TipTap extension, powered by harper.js in a web worker.
 *
 * Structurally mirrors the {@link Spellcheck} extension (debounce + meta-driven
 * async results + decoration mapping), with two differences: the check is
 * asynchronous (`checkDocument` awaits the worker) and the decoration carries a
 * result index rather than a word so the right-click menu can recover harper's
 * pre-computed suggestions.
 */
export const Grammar = Extension.create<GrammarOptions>({
  name: "grammar",

  addOptions() {
    return {
      grammarServiceRef: undefined as
        | { current: GrammarService | null }
        | undefined,
      enabledRef: undefined as { current: boolean } | undefined,
      ignoredRef: undefined as { current: Set<string> } | undefined,
      onContextMenu: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { grammarServiceRef, enabledRef, ignoredRef, onContextMenu } =
      this.options;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let needsImmediateCheck = false;
    // Guards against overlapping async checks dispatching stale results.
    let checkToken = 0;

    function cancelPending() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    }

    function scheduleCheck(view: EditorView, delay: number) {
      cancelPending();
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        runCheck(view);
      }, delay);
    }

    function runCheck(view: EditorView) {
      const enabled = enabledRef?.current ?? true;
      const service = grammarServiceRef?.current;
      if (!enabled || !service?.isLoaded()) return;

      const token = ++checkToken;
      const ignored = ignoredRef?.current ?? new Set<string>();
      service
        .checkDocument(view.state.doc, ignored)
        .then((results) => {
          // Drop results if a newer check superseded this one, or the editor
          // was torn down while the worker was busy.
          if (token !== checkToken || view.isDestroyed) return;
          const tr = view.state.tr.setMeta(GRAMMAR_RESULTS_META, results);
          view.dispatch(tr);
        })
        .catch((error) => {
          console.error("Grammar check failed:", error);
        });
    }

    return [
      new Plugin({
        key: grammarPluginKey,
        state: {
          init(): GrammarPluginState {
            return { decorations: DecorationSet.empty, results: [] };
          },
          apply(
            tr: Transaction,
            old: GrammarPluginState,
            _oldState,
            newState,
          ): GrammarPluginState {
            const enabled = enabledRef?.current ?? true;

            if (!enabled) {
              if (old.results.length > 0) {
                return { decorations: DecorationSet.empty, results: [] };
              }
              return old;
            }

            const asyncResults: GrammarResult[] | undefined =
              tr.getMeta(GRAMMAR_RESULTS_META);
            if (asyncResults) {
              const decorations = buildDecorations(asyncResults, newState.doc);
              return { decorations, results: asyncResults };
            }

            if (tr.getMeta(GRAMMAR_UPDATED_META)) {
              needsImmediateCheck = true;
              return old;
            }

            if (tr.docChanged && old.decorations !== DecorationSet.empty) {
              return {
                decorations: old.decorations.map(tr.mapping, newState.doc),
                results: old.results,
              };
            }

            return old;
          },
        },
        view() {
          return {
            update(view: EditorView, prevState) {
              const currentPluginState = grammarPluginKey.getState(view.state);
              const prevPluginState = grammarPluginKey.getState(prevState);
              if (
                currentPluginState &&
                prevPluginState &&
                currentPluginState.results !== prevPluginState.results
              ) {
                // Results just changed (arrived or cleared) — don't reschedule.
                return;
              }

              const enabled = enabledRef?.current ?? true;
              const service = grammarServiceRef?.current;
              if (!enabled || !service?.isLoaded()) return;

              if (needsImmediateCheck) {
                needsImmediateCheck = false;
                cancelPending();
                setTimeout(() => runCheck(view), 0);
                return;
              }

              const docChanged = view.state.doc !== prevState.doc;
              if (docChanged) {
                scheduleCheck(view, TYPING_DEBOUNCE);
              }
            },
            destroy() {
              cancelPending();
            },
          };
        },
        props: {
          decorations(state) {
            return (
              grammarPluginKey.getState(state)?.decorations ??
              DecorationSet.empty
            );
          },
          handleDOMEvents: {
            contextmenu: (view, event) => {
              if (!onContextMenu) return false;

              const target = event.target as HTMLElement;
              if (!target.classList.contains("grammar-error")) return false;

              const state = grammarPluginKey.getState(view.state);
              if (!state) return false;

              // Prefer the decoration's stashed index; fall back to position.
              let result: GrammarResult | undefined;
              const indexAttr = target.dataset.grammarIndex;
              if (indexAttr !== undefined) {
                result = state.results[Number(indexAttr)];
              }
              if (!result) {
                const pos = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });
                if (pos) {
                  result = state.results.find(
                    (r) => r.from <= pos.pos && r.to >= pos.pos,
                  );
                }
              }
              if (!result) return false;

              event.preventDefault();
              const rect = target.getBoundingClientRect();
              onContextMenu(result, rect);
              return true;
            },
          },
        },
      }),
    ];
  },
});

/** Get current grammar results from editor state. */
export function getGrammarResults(
  state: Parameters<typeof grammarPluginKey.getState>[0],
): GrammarResult[] {
  return grammarPluginKey.getState(state)?.results ?? [];
}
