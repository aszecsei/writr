# Editor

The editor is TipTap v3 with `tiptap-markdown` for round-tripping. **Content is stored as Markdown strings in Dexie**, not ProseMirror JSON. The active editor instance lives in `src/components/editor/ChapterEditor.tsx`.

## Layout

```
src/components/editor/
  ChapterEditor.tsx           Top-level editor; "use no memo" for TipTap's imperative DOM
  EditorToolbar.tsx           Main toolbar (formatting, headings, lists, alignment)
  ScreenplayToolbar.tsx       Screenplay-mode toolbar (scene headings, action, dialogue, …)
  FindReplacePanel.tsx        Find & replace UI driven by findReplaceStore
  FocusModeOverlay.tsx        Dim-non-active-paragraph overlay
  toolbar-actions.ts          Shared command helpers
  AlignmentDropdown.tsx       FontSelector.tsx       FontSizeSelector.tsx
  CopyMenu.tsx                TextToolsMenu.tsx
  InsertImageDialog.tsx       LinkEditorDialog.tsx   RubyDialog.tsx
  SpellcheckContextMenu.tsx   SpellcheckScannerModal.tsx
  VersionHistoryDialog.tsx
  comments/                   Comment thread UI, margin rendering
  extensions/                 Custom TipTap extensions (see below)
```

## Custom extensions

Located in `src/components/editor/extensions/`.

### Prose extensions

- **`Comments`** — inline anchored comments with ProseMirror `Mapping`-based offset tracking.
- **`SearchAndReplace`** — search/replace decorations, driven by `findReplaceStore`.
- **`TypewriterScrolling`** — keeps the active line centered.
- **`Spellcheck`** — squiggle decorations, integrates with `nspell` via `spellcheckStore`.
- **`Indent`** — paragraph indentation marks.
- **`Ruby`** — ruby-text annotations (CJK reading hints).
- **`SelectionPreserver`** — preserves selection across blur/focus, used for toolbar dialogs.

### Screenplay extensions (`extensions/screenplay/`)

`Centered`, `Action`, `Character`, `Dialogue`, `Parenthetical`, `SceneHeading`, `Transition`, `ScreenplayPageBreak`. Pair with `src/lib/fountain/` for parsing/serialization.

## TipTap conventions

- **Default ref-type extension options to `undefined` in `addOptions()`** to prevent deep-merge from clobbering refs. Pass refs (`commentsRef`, `enabledRef`, etc.) so the extension can react to runtime toggles without recreating the editor.
- TipTap storage access requires casting through `unknown` because the `Storage` type doesn't expose extension-specific properties.
- `ChapterEditor` uses `"use no memo"` to opt out of the React Compiler — TipTap mutates DOM imperatively and breaks otherwise.

## Comments data model

Comments are stored in Dexie with `fromOffset`/`toOffset` (1-indexed ProseMirror positions). The `Comments` extension maps those positions through doc changes via `Mapping`. Point comments (`from === to`) render as markers; selection comments (`from < to`) render as highlights. Reconciliation utilities live in `src/lib/comments/`.
