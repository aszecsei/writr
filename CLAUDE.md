# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (starts on localhost:3000)
- **Build:** `npm run build`
- **Start production:** `npm run start`
- **Lint:** `npm run lint` (runs `biome check`)
- **Format:** `npm run format` (runs `biome format --write`)
- **Test:** `npm run test` (runs `vitest run`)
- **Test (watch):** `npm run test:watch` (runs `vitest`)

**Testing:** Vitest with `fake-indexeddb` for IndexedDB mocking. Config in `vitest.config.ts`, setup in `src/test/setup.ts`. Tests are colocated next to source files (e.g., `operations.test.ts` alongside `operations.ts`).

## Architecture

Long-form writing app with multi-project support, chapter-based rich-text editing, a story bible, and AI integration via OpenRouter.

**Framework:** Next.js 16 App Router (`src/app/`), React 19 with React Compiler enabled. TypeScript strict mode. All route pages are `"use client"` since data lives in IndexedDB.

**Styling:** Tailwind CSS v4 via PostCSS. Theme variables in `src/app/globals.css`.

**Linting/Formatting:** Biome (not ESLint/Prettier). 2-space indentation. Import organization is enforced. Tailwind directives enabled in CSS parser.

**Path alias:** `@/*` maps to `./src/*`.

**Notable libraries:** @dnd-kit (drag-drop), @xyflow/react (family tree), react-resizable-panels, nspell (spellcheck), ts-pattern, marked, diff, react-player, html2canvas.

## Key Layers

- **`src/db/schemas.ts`** — Zod schemas are the single source of truth for all data types. Entities: Project, Chapter, Character, CharacterRelationship, Location, TimelineEvent, StyleGuideEntry, WorldbuildingDoc, OutlineGridColumn, OutlineGridRow, OutlineGridCell, WritingSprint, WritingSession, PlaylistTrack, ChapterSnapshot, Comment, AppSettings, AppDictionary, ProjectDictionary.
- **`src/db/database.ts`** — Dexie (IndexedDB) database class with table definitions, compound indexes, and 15 migration versions. Singleton `db` export.
- **`src/db/operations/`** — Directory of 18 files organized by entity (chapters, characters, comments, dictionary, locations, outline, playlist, projects, settings, snapshots, sprints, style-guide, timeline, worldbuilding). `helpers.ts` exports `generateId()` and `now()`. Validates with Zod before writing. Cascading deletes for projects. Components never import Dexie directly. See also `src/db/chapter-outline-sync.ts` for chapter-to-outline-row synchronization.
- **`src/store/`** — Eight Zustand stores using Immer middleware (ephemeral UI state only):
  - `uiStore` — sidebar, modals (discriminated union), AI panel, focus mode
  - `editorStore` — active document, dirty/save state, word count, selection, content version
  - `projectStore` — active project/chapter context, chapter order
  - `commentStore` — selected comment, margin visibility
  - `sprintStore` — active sprint timer, word tracking, config/history modals
  - `spellcheckStore` — enabled state, ignored words, context menu, scanner
  - `findReplaceStore` — search/replace terms, modes (regex/case/whole-word), match tracking
  - `radioStore` — playlist playback, queue, volume, shuffle/loop (persisted)
- **`src/hooks/`** — React hooks bridging Dexie and components via `useLiveQuery`. Factory pattern: `createEntityHook()`, `createProjectListHook()`, `createProjectListUnsortedHook()` in `factories.ts`. Key hooks: `useAutoSave`, `useChapter`, `useComments`, `useSearch`, `useWritingStats`, `useWritingSprint`, `useAppSettings`, `useBibleEntries` (characters/locations/timeline/etc.), `useOutlineGrid*`, `useCharacterForm`, `useLocationForm`, `useSnapshots`, `useDictionary`, `usePlaylistEntries`.
- **`src/components/editor/`** — TipTap editor with `tiptap-markdown` for Markdown round-tripping. Content stored as Markdown strings in Dexie. Custom extensions in `extensions/`: Comments, SearchAndReplace, TypewriterScrolling, Spellcheck, Indent, Ruby, SelectionPreserver. Toolbar in `EditorToolbar.tsx`, comments UI in `comments/`, find-replace in `FindReplacePanel.tsx`.
- **`src/components/ui/`** — Reusable UI primitives (see Reusable Components section below).
- **`src/lib/ai/`** — OpenRouter integration. `client.ts` calls `/api/ai` (Next.js route handler that proxies to OpenRouter). Streaming via `streamAi()` generator. `prompts.ts` builds system prompts from story bible + outline grid context. Seven AI tools: generate-prose, review-text, suggest-edits, character-dialogue, brainstorm, summarize, consistency-check.
- **`src/lib/export/`** — Export pipeline for manuscripts. Supports Markdown, DOCX (via `docx`), PDF (via `pdfmake`), and HTML. `clipboard.ts` provides Markdown + AO3-compatible HTML clipboard export. `gather.ts` collects chapter data, `markdown-to-nodes.ts` converts markdown to document nodes.
- **`src/lib/`** — Additional sub-libraries:
  - `spellcheck/` — nspell service with CDN dictionary caching, Unicode tokenizer
  - `search/` — project-wide full-text search across 7 entity types, paginated
  - `backup/` — full/project backup & import with Zod validation, conflict resolution
  - `theme/` — 10 primary + 5 neutral color palettes, `applyPrimaryColor()`, `applyNeutralColor()`, `applyEditorWidth()`, `applyUiDensity()`
  - `preview-card/` — html2canvas-based image generation
  - `comments/` — comment offset reconciliation
  - `radio/` — playlist metadata and URL parsing utilities
  - Standalone: `smart-quotes.ts`, `reading-time.ts`, `worldbuilding-tree.ts`, `fonts.ts`, `id.ts`, `constants.ts` (default intervals, font sizes, model, singleton IDs)

## Routing

```
/                                        — Dashboard (project picker)
/projects/[projectId]                    — Project overview (layout: sidebar + topbar)
/projects/[projectId]/chapters/[id]      — Chapter editor (TipTap)
/projects/[projectId]/outline            — Outline grid view
/projects/[projectId]/search             — Project-wide search
/projects/[projectId]/bible              — Story bible overview
/projects/[projectId]/bible/characters   — Character list & [characterId] detail
/projects/[projectId]/bible/locations    — Location list & [locationId] detail
/projects/[projectId]/bible/timeline     — Timeline editor
/projects/[projectId]/bible/style-guide  — Style guide entries
/projects/[projectId]/bible/worldbuilding — Worldbuilding docs & [docId] editor
/projects/[projectId]/bible/family-tree  — Character relationship diagram (XYFlow)
/projects/[projectId]/bible/playlist     — Music/mood playlist (YouTube)
/api/ai                                  — POST proxy to OpenRouter
```

## Data Flow

**Editor:** Dexie → markdown string → TipTap (ProseMirror doc) → user edits → `editor.storage.markdown.getMarkdown()` → debounced auto-save → Dexie. Word count is denormalized on each save.

**AI:** Client gathers story bible context (characters, locations, style guide) → builds system prompt → POST `/api/ai` → proxied to OpenRouter → streamed response displayed in AI panel.

**Comments:** Stored in Dexie with `fromOffset`/`toOffset` (ProseMirror positions, 1-indexed). The Comments extension maps positions through doc changes via ProseMirror `Mapping`. Point comments (`from === to`) render as markers; selection comments (`from < to`) render as highlights.

## Reusable Components & Styles

Before creating new UI, check these existing primitives in `src/components/ui/`:

- **`Modal`** — Backdrop + panel + escape-to-close. Props: `children`, `onClose`, `maxWidth?`
- **`ConfirmDialog`** — Yes/no with optional third action. Props: `title`, `message`, `onConfirm`, `onCancel`, `variant`, `extraAction?`
- **`ContextMenu`** — Positioned right-click menu with viewport flipping. Compound: `ContextMenu`, `ContextMenuItem`, `ContextMenuSeparator`, `ContextMenuLabel`
- **`Badge`** — Simple styled span. Props: `label`, `className?`
- **`AutoResizeTextarea`** — Auto-growing textarea. Also exports `useHeightSync()` for syncing heights across fields
- **`DialogFooter`** — Standard Cancel + Submit footer with optional left slot

Button/form class exports:
- `button-styles.ts` → `BUTTON_PRIMARY`, `BUTTON_CANCEL`, `BUTTON_DANGER`, `RADIO_BASE/ACTIVE/INACTIVE`
- `form-styles.ts` → `INPUT_CLASS`, `LABEL_CLASS` (also re-exports all button styles)

Modal system: `uiStore.modal` is a discriminated union (13 variants). Open via `openModal()`, close via `closeModal()`. Single modal rendered in `AppShell`.

## Conventions

- Entity IDs are UUIDv4 strings (`crypto.randomUUID()`). Timestamps are ISO 8601 strings.
- Cross-references between bible entries use UUID arrays (e.g., `linkedCharacterIds`), not join tables.
- **Singleton rows:** `AppSettings` (id = `"app-settings"`), `AppDictionary` (id = `"app-dictionary"`).
- **TipTap extension options:** Default ref-type options to `undefined` in `addOptions()` to prevent deep-merge. Pass refs (e.g., `commentsRef`, `enabledRef`) for runtime toggling without recreating the editor.
- **`"use no memo"`** on `ChapterEditor` — opts out of React Compiler for TipTap's imperative DOM.
- TipTap storage access requires casting through `unknown` since the Storage type doesn't expose extension-specific properties.
- **CSS custom properties:** `--primary-*`, `--neutral-*` (color scales), `--editor-content-width`, `--density-*`. Custom Tailwind utilities: `py-density-item`, `py-density-button`, `gap-density`. Density controlled by `[data-density]` attribute.
- **Hook factories:** Use `createEntityHook(table)` / `createProjectListHook(table, sortField)` from `src/hooks/factories.ts` to add new entity hooks — don't write custom `useLiveQuery` calls.
- **Test helpers:** Factory functions in `src/test/helpers.ts` (e.g., `makeChapter()`, `makeCharacter()`, `makeRelationship()`). Use these in tests instead of manually constructing entities.
