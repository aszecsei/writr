# Editor

The editor is TipTap v3 with `tiptap-markdown` for round-tripping. **Content is stored as Markdown strings in Dexie**, not ProseMirror JSON. The active editor instance lives in `src/components/editor/ChapterEditor.tsx`.

## Layout

```
src/components/editor/
  ChapterEditor.tsx           Top-level editor; "use no memo" for TipTap's imperative DOM
  EditorToolbar.tsx           Main toolbar (formatting, headings, lists, alignment); also
                               exports SharedChapterActions (see below)
  ScreenplayToolbar.tsx       Screenplay-mode toolbar (scene headings, action, dialogue, …)
  FindReplacePanel.tsx        Find & replace UI driven by findReplaceStore
  FocusModeOverlay.tsx        Dim-non-active-paragraph overlay
  toolbar-actions.ts          Shared ToolbarAction[] definitions (prose actions,
                               screenplay element-type actions)
  AlignmentDropdown.tsx       FontSelector.tsx       FontSizeSelector.tsx
  CopyMenu.tsx                TextToolsMenu.tsx
  InsertImageDialog.tsx       LinkEditorDialog.tsx   RubyDialog.tsx
  SpellcheckContextMenu.tsx   SpellcheckScannerModal.tsx
  GrammarContextMenu.tsx      GrammarScannerModal.tsx
  IssueContextMenu.tsx        IssueScannerModal.tsx
  VersionHistoryDialog.tsx
  comments/                   Comment thread UI, margin rendering
  extensions/                 Custom TipTap extensions (see below)
```

## Toolbars

`EditorToolbar` and `ScreenplayToolbar` share their project/chapter-scoped
actions (export, version history, copy, comments, spellcheck toggle/scanner,
focus mode) via `SharedChapterActions`, exported from `EditorToolbar.tsx` and
rendered by both toolbars. `SharedChapterActions` takes `beforeCopy` /
`afterCopy` / `afterSpellcheck` `ReactNode` slots so each toolbar can
interleave its own extras (e.g. `ShareSessionButton`, `TextToolsMenu`, the
grammar toggle/scanner in `EditorToolbar`) without reshuffling the shared
buttons. Both toolbars are built from `ToolbarButton` / `ToolbarSeparator`
(`src/components/ui/`).

`toolbar-actions.ts` exports `ToolbarAction`, a discriminated union on
`kind`: `{ kind: "command"; run(editor) }` for actions that mutate the
editor directly, or `{ kind: "modal"; modal: "link-editor" | "insert-image" | "ruby-editor" }`
for actions that open a dialog — `EditorToolbar` dispatches on `action.kind`
rather than the action's label text. `screenplayElementActions` holds the
screenplay element-type buttons (scene heading, action, character, …) in the
same shape; `ScreenplayToolbar`'s undo/redo buttons reuse the `"history"`
group from the shared `actions` array instead of hand-rolling `undo()`/`redo()`.

## Spellcheck and grammar checkers

`SpellcheckContextMenu`/`GrammarContextMenu` and `SpellcheckScannerModal`/`GrammarScannerModal` are thin wrappers that map `spellcheckStore`/`grammarStore` onto two shared presentational components: `IssueContextMenu` (built on `ui/ContextMenu`) and `IssueScannerModal` (built on `ui/Modal`, `maxWidth="max-w-lg"`). The shared components own the keyboard shortcuts (1-5 for suggestions, Enter for the first suggestion, arrows to navigate) and the empty-state view; each wrapper only supplies its domain-specific headline, context highlighting, suggestions, and action buttons.

The scanner modals are `uiStore.modal` variants (`spellcheck-scanner` / `grammar-scanner` — see `docs/state.md`), so they close on Escape and backdrop click like every other dialog. `spellcheckStore` and `grammarStore` still each own their own `contextMenu` and `scanner` state (unrelated to `uiStore.modal`); both are built on the shared `createCheckerSlice` in `src/store/createCheckerStore.ts` (see `docs/state.md`).

Both scanner wrappers, `FindReplacePanel.tsx`'s `scrollToMatch`, the scene-scroll helper in `useEditorSeed`, and `comments/position.ts`'s `calculateCommentTop` all center or locate content in the editor's scroll container via `scrollToPos`/`getScrollContainer` (`src/lib/editor/scroll.ts`). `TypewriterScrolling` and `useFocusMode` scroll the same container but with different math (an instant, delta-based `scrollBy` with a jitter threshold, and an instant rather than smooth absolute scroll respectively) and are not on the shared helper.

## Custom extensions

Located in `src/components/editor/extensions/`.

### Prose extensions

- **`Comments`** — inline anchored comments with ProseMirror `Mapping`-based offset tracking.
- **`SearchAndReplace`** — search/replace decorations, driven by `findReplaceStore`. Owns the search state and exposes it as TipTap commands (`search`, `findNext`, `findPrevious`, `replaceCurrent`, `replaceAll`); `FindReplacePanel` calls these instead of re-dispatching `SEARCH_UPDATED_META` and reading state back after a `setTimeout`.
- **`TypewriterScrolling`** — keeps the active line centered.
- **`Spellcheck`** — squiggle decorations, integrates with `nspell` via `spellcheckStore`.
- **`Grammar`** — blue squiggle decorations for grammar/style issues, integrates with `harper.js` (web worker) via `grammarStore`. Async check; spelling lints are filtered (nspell owns spelling). Toggle persists in the `grammarCheckerEnabled` AppSettings field.
- **`Indent`** — paragraph indentation marks.
- **`Ruby`** — ruby-text annotations (CJK reading hints).

### Screenplay extensions (`extensions/screenplay/`)

`Centered`, `Action`, `Character`, `Dialogue`, `Parenthetical`, `SceneHeading`, `Transition`, `ScreenplayPageBreak`. Pair with `src/lib/fountain/` for parsing/serialization.

## TipTap conventions

- **Default ref-type extension options to `undefined` in `addOptions()`** to prevent deep-merge from clobbering refs. Pass refs (`commentsRef`, `enabledRef`, etc.) so the extension can react to runtime toggles without recreating the editor.
- TipTap storage access requires casting through `unknown` because the `Storage` type doesn't expose extension-specific properties.
- `ChapterEditor` uses `"use no memo"` to opt out of the React Compiler — TipTap mutates DOM imperatively and breaks otherwise.

## Comments data model

Comments are stored in Dexie with `fromOffset`/`toOffset` (1-indexed ProseMirror positions). The `Comments` extension maps those positions through doc changes via `Mapping`. Point comments (`from === to`) render as markers; selection comments (`from < to`) render as highlights. Reconciliation utilities live in `src/lib/comments/`.

Comments support **flat threading**: each row carries `parentCommentId: CommentId | null`. Roots have `parentCommentId === null` and own the position/anchor; replies inherit the parent's position fields at creation and stay in sync via `updateCommentPositions` (the editor batch-sync skips replies, then propagates the root's mapped position to any replies in the same transaction). `CommentMargin` filters to roots and renders a reply-count badge; `CommentPopover` renders the root + replies as a thread with an inline reply composer. The `reply_to_comment` AI tool and human "Reply" UI both call `CommentsAdapter.create({ ..., parentCommentId })`. Replies-of-replies are rejected at the tool boundary — only one level of nesting is supported.
