# Other libraries (`src/lib/`)

This file documents `src/lib/` subdirectories that aren't covered by their own dedicated doc. See `docs/ai.md`, `docs/agents.md`, and `docs/collab.md` for those areas.

## `export/` — Manuscript export pipeline

Generates exports for the entire book or a single chapter, for five formats: Markdown, DOCX, PDF, Fountain, and (for `clipboard.ts`) AO3-compatible HTML.

- `gather.ts` — Collects chapter content (and optional bible context) for an export job.
- `markdown-to-nodes.ts` — Parses Markdown into a neutral document-node tree (`DocNode`), matching against `marked`'s own `MarkedToken` union so ts-pattern narrows each branch without re-casting.
- `for-each-export-item.ts` — `forEachExportItem(content, options, hooks)`: the shared title-page/chapter-heading/separator/page-break iteration order, driven by `ExportLoopOptions` (the 4 fields it needs, not the full `ExportOptions`). `visitor.ts`'s `buildExport` (which docx/pdf/html drive via the `DocNodeVisitor`/`Exporter` interfaces) and `exportMarkdown.ts` both build on it. Fountain and screenplay-PDF don't fit — they drop separators entirely and page-break between every sequence unconditionally rather than gating on `pageBreaksBetweenChapters` — so they keep their own loops.
- `pdfmake.ts` — `loadPdfMake()`: the dynamic-import/vfs/font-registration bootstrap shared by the two PDF emitters (`exporters/pdf-exporter.ts`, `exportScreenplayPdf.ts`).
- `index.ts`'s `performExport` dispatches on format directly (constructing `DocxExporter`/`PdfExporter` inline for those two); there is no separate exporter-factory indirection.
- `clipboard.ts` — Copies selection as Markdown plus AO3-compatible HTML.

`chapter.level` (binder nesting depth) only affects heading depth in the Markdown export; docx/pdf/html chapter headings are a single fixed style regardless of nesting.

## `spellcheck/` — Spellchecking

`nspell`-based service with CDN dictionary caching and a Unicode-aware tokenizer (built on `prosemirror/extract-text-blocks.ts`). Wired into the editor via the `Spellcheck` extension and `spellcheckStore`.

## `grammar/` — Grammar checking

`harper.js`-based grammar/style checker running in a web worker (`WorkerLinter` with the inlined WASM binary — no separate bundler assets). `GrammarService` and `SpellcheckService` are both lazy singletons built on `lazy-service.ts`'s `createLazyService()`; `extractor.ts` walks the document block-by-block (via `prosemirror/extract-text-blocks.ts`) and maps harper's character spans back to ProseMirror positions. Spelling-category lints are filtered out so `nspell` stays the sole spell checker. Wired into the editor via the `Grammar` extension and `grammarStore`; the on/off toggle is the persisted `grammarCheckerEnabled` AppSettings field (default **off**). The "Style" category is disabled by default (`DEFAULT_DISABLED_LINT_KINDS` in `schemas.ts`).

Users filter which checks run via the **Grammar Rules** modal (`GrammarRulesDialog`, opened from Editor settings): broad **categories** (lint kinds in `categories.ts`, persisted as `disabledLintKinds` and filtered post-hoc) and **individual rules** (harper's rule keys via `getRuleInfo`, persisted as `grammarRuleOverrides` and applied with `setLintConfig`). `useEditorGrammar` re-applies both to the service and re-checks whenever they change.

## `lazy-service.ts` — Lazy singleton loader

`createLazyService(doLoad)` returns `{ load, isLoaded, isLoading, get }`: dedupes concurrent `load()` calls via a shared promise and always clears `isLoading` (even when `doLoad` throws) via `finally`. Backs both `SpellcheckService` and `GrammarService`.

## `prosemirror/` — Shared document walker

`extract-text-blocks.ts`'s `extractTextBlocks(doc)` is the one place that knows how to walk a ProseMirror doc's inline content: skip `codeBlock`, collapse inline `code`-marked text and other atoms to a placeholder character, treat `hardBreak` as a boundary, and track absolute positions. Returns one `TextBlock` (`{ node, pos, runs }`) per textblock; `flattenBlock()` concatenates a block's runs into `{ text, offsets }` (offsets\[i\] = the ProseMirror position of `text[i]`). Consumed by `grammar/extractor.ts`, `spellcheck/tokenizer.ts`, `smart-quotes.ts`, and `normalize-line-breaks.ts`.

## `text/` — Small text utilities

`split-paragraphs.ts` (`splitParagraphs`, blank-line split with trim + empty-paragraph drop), `words-of.ts` (`wordsOf`, whitespace split with empty-token drop), `escape-reg-exp.ts` (`escapeRegExp`). Shared across `tts/`, `retrieval/`, `text-analysis/`, `holes.ts`, `spellcheck/auto-populate.ts`, and (the one cross-area exception) `ai/tool-calling/tools/`.

## `search/` — Project-wide search

Paginated full-text search across 8 entity types (chapters, characters, locations, timeline events, style guide entries, guardrails, worldbuilding docs, outline grid cells). Backs `/projects/[projectId]/search`. `entity-config.ts`'s `entityConfigs` is the single table driving indexing: each entry carries `titleField`/`subtitleField`/`loadEntities` alongside its existing `label`/`buildUrl`/`searchableFields`, so `build-index.ts`'s `loadEntityDocs` is one generic function reading the config instead of one branch per entity type (`outlineCell` is the one exception — its display title needs a row/column join, so it keeps its own `loadOutlineCellDocs`). `search.ts`'s `runQuery`/`runParagraphQuery` both build on the shared `runScoredQuery()` pipeline (parseQuery → BM25 candidates → phrase post-filter → sort).

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

## `text-analysis/` — Prose analysis (readability, style flags, echoes)

Backs the Analysis Panel. `analyze.ts`'s `analyzeSentences()` builds one chapter's `ChapterAnalysis` from `AnalyzedSentence[]` (produced by `nlp.ts`'s compromise-backed `parseParagraph()`); `aggregate.ts` rolls chapter analyses up to project/library scope. The metric modules (`metrics/*.ts`) each take `readonly AnalyzedTerm[]`/`readonly AnalyzedSentence[]` and stay decoupled from compromise's own types.

- `thresholds.ts` — Every numeric knob (echo window/limits, sticky threshold, sentence-length and density-band boundaries, MTLD minimums), collected in one place instead of scattered as module-level consts across the metric files.
- `presentation.ts` — The banding helpers that map a raw metric to a user-facing bucket/label: `readabilityBand`, `paragraphDensityLevel`, `echoSeverity`, `bucketForLength`.
- `excerpt.ts` — `makeExcerpt()`, a length-clamped sentence excerpt for echo/sticky-sentence UI.
- `index.ts` re-exports all of the above (plus the metric/aggregate/cache functions) under their existing names, so components import from the barrel; `SentenceLengthPreview.ts` is the one deliberate exception, deep-importing `bucketForLength` from `presentation.ts` directly to keep the compromise-backed barrel out of the editor bundle.

## Standalone files

- `terminology.ts` — Maps user-facing terms based on project mode (e.g., "Chapter" vs. "Sequence" for screenplays). Use this any time you render an entity-type label.
- `smart-quotes.ts` — Curly-quote conversion for typed text.
- `normalize-line-breaks.ts` — Collapses paired hard breaks in a paragraph.
- `reading-time.ts` — Word-count → minutes estimation.
- `format-time.ts` — Clock/duration/relative-time formatters (countdown timers, playback bars, hour-of-day labels, relative timestamps, sprint history).
- `download.ts` — `triggerDownload()`, a throwaway-anchor blob download.
- `filename.ts` — `sanitizeFilename()`, lowercase-kebab-case for filenames.
- `hash.ts` — `hashText()`, a non-cryptographic FNV-1a hash for change detection.
- `holes.ts` — Detects/strips bracketed "hole" placeholders in prose.
- `punctuation-match.ts` — Punctuation-tolerant substring matching for LLM-generated anchors.
- `worldbuilding-tree.ts` — Hierarchical worldbuilding doc tree utilities.
- `fonts.ts` — Available fonts and their CSS metadata.
- `id.ts` — UUID helpers.
- `constants.ts` — Singleton row IDs.
