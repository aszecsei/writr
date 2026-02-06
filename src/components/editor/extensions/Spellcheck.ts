import { Extension } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { SpellcheckResult, SpellcheckService } from "@/lib/spellcheck";

export interface SpellcheckOptions {
  spellcheckerRef: { current: SpellcheckService | null } | undefined;
  customWordsRef: { current: Set<string> } | undefined;
  enabledRef: { current: boolean } | undefined;
  ignoredWordsRef: { current: Set<string> } | undefined;
  onContextMenu?: (
    word: string,
    from: number,
    to: number,
    suggestions: string[],
    rect: DOMRect,
  ) => void;
}

export const spellcheckPluginKey = new PluginKey<SpellcheckPluginState>(
  "spellcheck",
);

/** Metadata key used to signal that spellcheck should rebuild. */
export const SPELLCHECK_UPDATED_META = "spellcheckUpdated";

/** Metadata key for delivering async spellcheck results. */
const SPELLCHECK_RESULTS_META = "spellcheckResults";

interface SpellcheckPluginState {
  decorations: DecorationSet;
  results: SpellcheckResult[];
}

function buildDecorations(
  results: SpellcheckResult[],
  doc: Parameters<typeof DecorationSet.create>[0],
): DecorationSet {
  if (results.length === 0) {
    return DecorationSet.empty;
  }

  const decorations = results.map((result) =>
    Decoration.inline(result.from, result.to, {
      class: "spelling-error",
      "data-word": result.word,
    }),
  );

  return DecorationSet.create(doc, decorations);
}

/** Debounce delay for typing (ms). */
const TYPING_DEBOUNCE = 300;

export const Spellcheck = Extension.create<SpellcheckOptions>({
  name: "spellcheck",

  addOptions() {
    return {
      spellcheckerRef: undefined as
        | { current: SpellcheckService | null }
        | undefined,
      customWordsRef: undefined as { current: Set<string> } | undefined,
      enabledRef: undefined as { current: boolean } | undefined,
      ignoredWordsRef: undefined as { current: Set<string> } | undefined,
      onContextMenu: undefined,
    };
  },

  addProseMirrorPlugins() {
    const {
      spellcheckerRef,
      customWordsRef,
      enabledRef,
      ignoredWordsRef,
      onContextMenu,
    } = this.options;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    // Track whether an immediate check was signaled (e.g. SPELLCHECK_UPDATED_META)
    let needsImmediateCheck = false;

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
      const spellchecker = spellcheckerRef?.current;

      if (!enabled || !spellchecker || !spellchecker.isLoaded()) return;

      // Update custom words on the spellchecker
      if (customWordsRef?.current) {
        spellchecker.setCustomWords(customWordsRef.current);
      }

      const ignoredWords = ignoredWordsRef?.current ?? new Set<string>();
      const results = spellchecker.checkDocument(view.state.doc, ignoredWords);

      // Dispatch results via meta — this will be picked up by apply()
      const tr = view.state.tr.setMeta(SPELLCHECK_RESULTS_META, results);
      view.dispatch(tr);
    }

    return [
      new Plugin({
        key: spellcheckPluginKey,
        state: {
          init(): SpellcheckPluginState {
            return {
              decorations: DecorationSet.empty,
              results: [],
            };
          },
          apply(
            tr: Transaction,
            old: SpellcheckPluginState,
            _oldState,
            newState,
          ): SpellcheckPluginState {
            const enabled = enabledRef?.current ?? true;

            // If disabled, clear decorations
            if (!enabled) {
              if (old.results.length > 0) {
                return { decorations: DecorationSet.empty, results: [] };
              }
              return old;
            }

            // Check if this transaction carries async results
            const asyncResults: SpellcheckResult[] | undefined = tr.getMeta(
              SPELLCHECK_RESULTS_META,
            );
            if (asyncResults) {
              const decorations = buildDecorations(asyncResults, newState.doc);
              return { decorations, results: asyncResults };
            }

            // Signal from SPELLCHECK_UPDATED_META — schedule immediate check
            if (tr.getMeta(SPELLCHECK_UPDATED_META)) {
              needsImmediateCheck = true;
              // Return old state; the view handler will run the check
              return old;
            }

            // On doc change, map existing decorations to preserve positions
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
              // Don't re-schedule when we just delivered results
              // Check the transactions that led to this update
              // We can check if the current state has new results by comparing
              const currentPluginState = spellcheckPluginKey.getState(
                view.state,
              );
              const prevPluginState = spellcheckPluginKey.getState(prevState);
              if (
                currentPluginState &&
                prevPluginState &&
                currentPluginState.results !== prevPluginState.results &&
                currentPluginState.results.length > 0
              ) {
                // Results just arrived, don't schedule another check
                return;
              }

              const enabled = enabledRef?.current ?? true;
              const spellchecker = spellcheckerRef?.current;
              if (!enabled || !spellchecker || !spellchecker.isLoaded()) return;

              // Immediate check takes priority (from SPELLCHECK_UPDATED_META)
              if (needsImmediateCheck) {
                needsImmediateCheck = false;
                cancelPending();
                // Use setTimeout(0) to avoid dispatching inside an update cycle
                setTimeout(() => runCheck(view), 0);
                return;
              }

              // Doc changed — schedule debounced check
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
              spellcheckPluginKey.getState(state)?.decorations ??
              DecorationSet.empty
            );
          },
          handleDOMEvents: {
            contextmenu: (view, event) => {
              if (!onContextMenu) return false;

              const target = event.target as HTMLElement;
              if (!target.classList.contains("spelling-error")) return false;

              event.preventDefault();

              const word = target.dataset.word;
              if (!word) return false;

              const state = spellcheckPluginKey.getState(view.state);
              if (!state) return false;

              // Find the result matching the clicked position
              const pos = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              let result: SpellcheckResult | undefined;
              if (pos) {
                result = state.results.find(
                  (r) => r.from <= pos.pos && r.to >= pos.pos,
                );
              }
              // Fallback: find by word text
              if (!result) {
                result = state.results.find((r) => r.word === word);
              }
              if (!result) return false;

              // Compute suggestions on-demand
              const spellchecker = spellcheckerRef?.current;
              const suggestions = spellchecker
                ? spellchecker.getSuggestions(word)
                : [];

              const rect = target.getBoundingClientRect();
              onContextMenu(word, result.from, result.to, suggestions, rect);

              return true;
            },
          },
        },
      }),
    ];
  },
});

/**
 * Get current spellcheck results from editor state.
 */
export function getSpellcheckResults(
  state: Parameters<typeof spellcheckPluginKey.getState>[0],
): SpellcheckResult[] {
  return spellcheckPluginKey.getState(state)?.results ?? [];
}
