import { Extension } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const searchAndReplacePluginKey = new PluginKey<SearchPluginState>(
  "searchAndReplace",
);

/** Metadata key used to signal that search should rebuild decorations. */
export const SEARCH_UPDATED_META = "searchUpdated";

interface SearchMatch {
  from: number;
  to: number;
}

interface SearchPluginState {
  decorations: DecorationSet;
  matches: SearchMatch[];
  currentIndex: number;
  searchTerm: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(
  doc: Parameters<typeof DecorationSet.create>[0],
  term: string,
  options: { caseSensitive: boolean; wholeWord: boolean; useRegex: boolean },
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

export type SearchAndReplaceOptions = Record<string, never>;

export const SearchAndReplace = Extension.create<SearchAndReplaceOptions>({
  name: "searchAndReplace",

  addKeyboardShortcuts() {
    return {
      "Mod-f": () => {
        // Dispatch meta to open find panel — the panel listens via store
        const { useFindReplaceStore } =
          require("@/store/findReplaceStore") as typeof import("@/store/findReplaceStore");
        useFindReplaceStore.getState().openFind();
        return true;
      },
      "Mod-h": () => {
        const { useFindReplaceStore } =
          require("@/store/findReplaceStore") as typeof import("@/store/findReplaceStore");
        useFindReplaceStore.getState().openFindReplace();
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
              const matches = findMatches(newState.doc, meta.searchTerm, {
                caseSensitive: meta.caseSensitive,
                wholeWord: meta.wholeWord,
                useRegex: meta.useRegex,
              });

              let currentIndex = meta.currentIndex ?? 0;
              if (matches.length === 0) {
                currentIndex = 0;
              } else if (currentIndex >= matches.length) {
                currentIndex = 0;
              } else if (currentIndex < 0) {
                currentIndex = matches.length - 1;
              }

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
