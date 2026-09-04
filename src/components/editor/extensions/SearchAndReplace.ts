import { Extension } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useFindReplaceStore } from "@/store/findReplaceStore";

const searchAndReplacePluginKey = new PluginKey<SearchPluginState>(
  "searchAndReplace",
);

/** Metadata key used to signal that search should rebuild decorations. */
export const SEARCH_UPDATED_META = "searchUpdated";

interface SearchMatch {
  from: number;
  to: number;
}

interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

interface SearchPluginState extends SearchOptions {
  decorations: DecorationSet;
  matches: SearchMatch[];
  currentIndex: number;
  searchTerm: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchAndReplace: {
      /** Rebuild search matches/decorations for `term` and jump to `currentIndex` (defaults to 0). */
      search: (
        term: string,
        options: SearchOptions,
        currentIndex?: number,
      ) => ReturnType;
      /** Advance to the next match, wrapping around. */
      findNext: () => ReturnType;
      /** Move to the previous match, wrapping around. */
      findPrevious: () => ReturnType;
      /** Replace the current match with `replacement`. */
      replaceCurrent: (replacement: string) => ReturnType;
      /** Replace every match with `replacement`. */
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(
  doc: Parameters<typeof DecorationSet.create>[0],
  term: string,
  options: SearchOptions,
): SearchMatch[] {
  if (!term) return [];

  const matches: SearchMatch[] = [];

  let pattern: string;
  if (options.useRegex) {
    pattern = term;
  } else {
    pattern = escapeRegex(term);
  }

  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, options.caseSensitive ? "g" : "gi");
  } catch {
    // Invalid regex, return no matches
    return [];
  }

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const text = node.text;
    let match: RegExpExecArray | null;

    // Reset lastIndex for global regex
    regex.lastIndex = 0;
    match = regex.exec(text);
    while (match !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      matches.push({ from, to });
      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex = match.index + 1;
      }
      match = regex.exec(text);
    }
  });

  return matches;
}

function buildSearchDecorations(
  matches: SearchMatch[],
  currentIndex: number,
  doc: Parameters<typeof DecorationSet.create>[0],
): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;

  const decorations = matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === currentIndex ? "search-match-current" : "search-match",
    }),
  );

  return DecorationSet.create(doc, decorations);
}

/** Resolve matches for `term` against `doc`, clamping `requestedIndex` to a valid index (0 when there are no matches). */
function resolveMatches(
  doc: Parameters<typeof DecorationSet.create>[0],
  term: string,
  options: SearchOptions,
  requestedIndex: number | undefined,
): { matches: SearchMatch[]; currentIndex: number } {
  const matches = findMatches(doc, term, options);
  let currentIndex = requestedIndex ?? 0;
  if (matches.length === 0) {
    currentIndex = 0;
  } else if (currentIndex >= matches.length) {
    currentIndex = 0;
  } else if (currentIndex < 0) {
    currentIndex = matches.length - 1;
  }
  return { matches, currentIndex };
}

/** Push the latest match count/index into the find-replace store. */
function syncMatchInfo(matches: SearchMatch[], currentIndex: number): void {
  useFindReplaceStore.getState().setMatchInfo(matches.length, currentIndex);
}

export type SearchAndReplaceOptions = Record<string, never>;

export const SearchAndReplace = Extension.create<SearchAndReplaceOptions>({
  name: "searchAndReplace",

  addKeyboardShortcuts() {
    return {
      "Mod-f": () => {
        useFindReplaceStore.getState().openFind();
        return true;
      },
      "Mod-h": () => {
        useFindReplaceStore.getState().openFindReplace();
        return true;
      },
    };
  },

  addCommands() {
    return {
      search:
        (term, options, currentIndex) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(SEARCH_UPDATED_META, {
              searchTerm: term,
              ...options,
              currentIndex,
            });
            const { matches, currentIndex: resolvedIndex } = resolveMatches(
              tr.doc,
              term,
              options,
              currentIndex,
            );
            syncMatchInfo(matches, resolvedIndex);
          }
          return true;
        },

      findNext:
        () =>
        ({ state, tr, dispatch }) => {
          const current = getSearchState(state);
          if (!current || current.matches.length === 0) return false;
          if (dispatch) {
            const nextIndex =
              (current.currentIndex + 1) % current.matches.length;
            tr.setMeta(SEARCH_UPDATED_META, {
              searchTerm: current.searchTerm,
              caseSensitive: current.caseSensitive,
              wholeWord: current.wholeWord,
              useRegex: current.useRegex,
              currentIndex: nextIndex,
            });
            syncMatchInfo(current.matches, nextIndex);
          }
          return true;
        },

      findPrevious:
        () =>
        ({ state, tr, dispatch }) => {
          const current = getSearchState(state);
          if (!current || current.matches.length === 0) return false;
          if (dispatch) {
            const prevIndex =
              (current.currentIndex - 1 + current.matches.length) %
              current.matches.length;
            tr.setMeta(SEARCH_UPDATED_META, {
              searchTerm: current.searchTerm,
              caseSensitive: current.caseSensitive,
              wholeWord: current.wholeWord,
              useRegex: current.useRegex,
              currentIndex: prevIndex,
            });
            syncMatchInfo(current.matches, prevIndex);
          }
          return true;
        },

      replaceCurrent:
        (replacement) =>
        ({ state, tr, dispatch, commands }) => {
          const current = getSearchState(state);
          if (!current || current.matches.length === 0) return false;
          const match = current.matches[current.currentIndex];
          const applied = commands.insertContentAt(
            { from: match.from, to: match.to },
            replacement,
          );
          if (applied && dispatch) {
            tr.setMeta(SEARCH_UPDATED_META, {
              searchTerm: current.searchTerm,
              caseSensitive: current.caseSensitive,
              wholeWord: current.wholeWord,
              useRegex: current.useRegex,
              currentIndex: current.currentIndex,
            });
            const { matches, currentIndex } = resolveMatches(
              tr.doc,
              current.searchTerm,
              current,
              current.currentIndex,
            );
            syncMatchInfo(matches, currentIndex);
          }
          return applied;
        },

      replaceAll:
        (replacement) =>
        ({ state, tr, dispatch }) => {
          const current = getSearchState(state);
          if (!current || current.matches.length === 0) return false;
          if (dispatch) {
            // Apply all replacements in reverse order in a single transaction
            const matches = [...current.matches].reverse();
            for (const match of matches) {
              if (replacement) {
                tr.insertText(replacement, match.from, match.to);
              } else {
                tr.delete(match.from, match.to);
              }
            }
            tr.setMeta(SEARCH_UPDATED_META, {
              searchTerm: current.searchTerm,
              caseSensitive: current.caseSensitive,
              wholeWord: current.wholeWord,
              useRegex: current.useRegex,
            });
            const { matches: newMatches, currentIndex } = resolveMatches(
              tr.doc,
              current.searchTerm,
              current,
              undefined,
            );
            syncMatchInfo(newMatches, currentIndex);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchAndReplacePluginKey,
        state: {
          init(): SearchPluginState {
            return {
              decorations: DecorationSet.empty,
              matches: [],
              currentIndex: 0,
              searchTerm: "",
              caseSensitive: false,
              wholeWord: false,
              useRegex: false,
            };
          },
          apply(
            tr: Transaction,
            old: SearchPluginState,
            _oldState,
            newState,
          ): SearchPluginState {
            const meta = tr.getMeta(SEARCH_UPDATED_META) as
              | {
                  searchTerm: string;
                  caseSensitive: boolean;
                  wholeWord: boolean;
                  useRegex: boolean;
                  currentIndex?: number;
                }
              | undefined;

            if (meta) {
              const { matches, currentIndex } = resolveMatches(
                newState.doc,
                meta.searchTerm,
                meta,
                meta.currentIndex,
              );

              const decorations = buildSearchDecorations(
                matches,
                currentIndex,
                newState.doc,
              );

              return {
                decorations,
                matches,
                currentIndex,
                searchTerm: meta.searchTerm,
                caseSensitive: meta.caseSensitive,
                wholeWord: meta.wholeWord,
                useRegex: meta.useRegex,
              };
            }

            // If doc changed, re-run search with existing params
            if (tr.docChanged && old.searchTerm) {
              const matches = findMatches(newState.doc, old.searchTerm, {
                caseSensitive: old.caseSensitive,
                wholeWord: old.wholeWord,
                useRegex: old.useRegex,
              });

              let currentIndex = old.currentIndex;
              if (matches.length === 0) {
                currentIndex = 0;
              } else if (currentIndex >= matches.length) {
                currentIndex = matches.length - 1;
              }

              const decorations = buildSearchDecorations(
                matches,
                currentIndex,
                newState.doc,
              );

              return {
                ...old,
                decorations,
                matches,
                currentIndex,
              };
            }

            return old;
          },
        },
        props: {
          decorations(state) {
            return (
              searchAndReplacePluginKey.getState(state)?.decorations ??
              DecorationSet.empty
            );
          },
        },
      }),
    ];
  },
});

/**
 * Get the current search state from the editor.
 */
export function getSearchState(
  state: Parameters<typeof searchAndReplacePluginKey.getState>[0],
) {
  return searchAndReplacePluginKey.getState(state);
}
