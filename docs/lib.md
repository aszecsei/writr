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

## `grammar/` — Grammar checking

`harper.js`-based grammar/style checker running in a web worker (`WorkerLinter` with the inlined WASM binary — no separate bundler assets). `GrammarService` is a lazy singleton mirroring `SpellcheckService`; `extractor.ts` walks the document block-by-block and maps harper's character spans back to ProseMirror positions. Spelling-category lints are filtered out so `nspell` stays the sole spell checker. Wired into the editor via the `Grammar` extension and `grammarStore`; the on/off toggle is the persisted `grammarCheckerEnabled` AppSettings field (default **off**). The "Style" category is disabled by default (`DEFAULT_DISABLED_LINT_KINDS` in `schemas.ts`).

Users filter which checks run via the **Grammar Rules** modal (`GrammarRulesDialog`, opened from Editor settings): broad **categories** (lint kinds in `categories.ts`, persisted as `disabledLintKinds` and filtered post-hoc) and **individual rules** (harper's rule keys via `getRuleInfo`, persisted as `grammarRuleOverrides` and applied with `setLintConfig`). `useEditorGrammar` re-applies both to the service and re-checks whenever they change.

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

## `retrieval/` — Lore retrieval

Semantic + entity-linked context retrieval for the AI chat panel. When the user sends a message, the chat panel calls `useLoreRetrieval(projectId)` (from `src/hooks/data/useLoreRetrieval.ts`), which returns an async function that takes the active `Chapter` and returns a `RetrievalResult | null`. The result is mapped onto `AiContext.relevantLore`, `AiContext.pastEvents`, and `AiContext.futureEvents`, which `buildMessages` injects into the system prompt.

### Key files

- `types.ts` — Core interfaces: `RetrievalHit` (`title`, `text`, `sourceId`, `chunkIndex`, `score`), `RetrievalResult` (`lore`, `pastEvents`, `futureEvents`), `RetrievalSettings`.
- `embedding/get-provider.ts` — `EmbeddingProvider` seam. Currently returns a local transformers.js provider; the seam is the extension point for a server-side embedding API later.
- `embedding/local.ts` — Browser-local embeddings via `@xenova/transformers`. Runs in a shared worker to avoid blocking the main thread.
- `indexer.ts` — `reindexProject(...)` chunks worldbuilding docs and manuscript chapters (skipping the current chapter to avoid trivial self-matches), computes embeddings, and upserts into the `indexedChunks` Dexie store.
- `retriever.ts` — `retrieveContext(...)` runs two retrieval signals and merges them:
  - **Semantic cosine similarity** — brute-force dot product over all `indexedChunks` for the project. No external vector DB; IndexedDB holds the chunk vectors directly, which is fast enough for novel-scale corpora (thousands of chunks).
  - **Deterministic entity links** — chapters that reference the same `linkedCharacterIds` or `linkedLocationIds` as the query chapter are promoted, providing stable recall for named entities even when phrasing diverges.
- `chunker.ts` — Splits document text into overlapping fixed-size chunks before embedding.

### Directionality

Retrieval respects `RetrievalSettings.omniscient`. In the default **forward-only** mode, only chapters that precede the current chapter (by order) are eligible as scene sources, preventing the AI from being shown future plot events. Lore (worldbuilding docs) is always included regardless. Setting `omniscient: true` (controlled by the app's "Omniscient mode" toggle) lifts this restriction.

### Dexie store

Chunks are stored in the `indexedChunks` Dexie table (see `src/db/schemas.ts`). The brute-force cosine scan is chosen deliberately over a library like Vectra because IndexedDB's lack of native ANN support means any in-process ANN index must also be serialized/deserialized, eliminating the lookup advantage at small scale. At novel scale (< 10k chunks) brute-force is under 10 ms.

### Deferred items

- Server-side embedding endpoint (swap `getEmbeddingProvider()` return value; no other changes needed).
- Cursor-position weighting — boost chunks near the user's current editor position.
- `search_lore` AI tool — let the model trigger on-demand retrieval mid-conversation.
- Characters and locations as indexed sources (currently only worldbuilding docs and chapters are indexed).
- Real ANN index (e.g., HNSW) for projects that grow past ~50k chunks.

## Standalone files

- `terminology.ts` — Maps user-facing terms based on project mode (e.g., "Chapter" vs. "Sequence" for screenplays). Use this any time you render an entity-type label.
- `smart-quotes.ts` — Curly-quote conversion for typed text.
- `reading-time.ts` — Word-count → minutes estimation.
- `worldbuilding-tree.ts` — Hierarchical worldbuilding doc tree utilities.
- `fonts.ts` — Available fonts and their CSS metadata.
- `id.ts` — UUID helpers.
- `constants.ts` — Default intervals, font sizes, default model, singleton row IDs.
