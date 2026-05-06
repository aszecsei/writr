# Other libraries (`src/lib/`)

This file documents `src/lib/` subdirectories that aren't covered by their own dedicated doc. See `docs/ai.md`, `docs/agents.md`, and `docs/collab.md` for those areas.

## `export/` — Manuscript export pipeline

Generates exports for the entire book or a single chapter.

- `gather.ts` — Collects chapter content (and optional bible context) for an export job.
- `markdown-to-nodes.ts` — Parses Markdown into a neutral document-node tree.
- DOCX, PDF (`pdfmake`), Markdown, and HTML emitters.
- `clipboard.ts` — Copies selection as Markdown plus AO3-compatible HTML.

## `spellcheck/` — Spellchecking

`nspell`-based service with CDN dictionary caching and a Unicode-aware tokenizer. Wired into the editor via the `Spellcheck` extension and `spellcheckStore`.

## `search/` — Project-wide search

Paginated full-text search across 7 entity types (chapters, characters, locations, timeline events, style guide, worldbuilding docs, comments). Backs `/projects/[projectId]/search`.

## `backup/` — Backup & restore

Full-app and per-project backup/import with Zod validation and conflict resolution.

## `theme/` — Color, density, layout

10 primary palettes + 5 neutral palettes. Application helpers: `applyPrimaryColor()`, `applyNeutralColor()`, `applyEditorWidth()`, `applyUiDensity()`. Density is driven by `[data-density]`.

## `preview-card/` — Shareable images

Generates social-card images via `html2canvas` from selected text.

## `comments/` — Comment offset reconciliation

Helpers for keeping `Comment.fromOffset`/`toOffset` accurate across doc edits and snapshot restores.

## `radio/` — Playlist utilities

YouTube URL parsing and metadata helpers for the mood-playlist feature.

## `fountain/` — Screenplay format

In-house Fountain parser/serializer:

- `parse.ts` — Fountain text → AST.
- `serialize.ts` — AST → Fountain text.
- `fountain-to-prosemirror.ts` — AST → ProseMirror doc, paired with the screenplay extensions in `src/components/editor/extensions/screenplay/`.
- `types.ts`, `index.ts`.

## Standalone files

- `terminology.ts` — Maps user-facing terms based on project mode (e.g., "Chapter" vs. "Sequence" for screenplays). Use this any time you render an entity-type label.
- `smart-quotes.ts` — Curly-quote conversion for typed text.
- `reading-time.ts` — Word-count → minutes estimation.
- `worldbuilding-tree.ts` — Hierarchical worldbuilding doc tree utilities.
- `fonts.ts` — Available fonts and their CSS metadata.
- `id.ts` — UUID helpers.
- `constants.ts` — Default intervals, font sizes, default model, singleton row IDs.
