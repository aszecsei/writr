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

## Key Layers

- **`src/db/schemas.ts`** — Zod schemas are the single source of truth for all data types. Every entity (Project, Chapter, Character, Location, TimelineEvent, StyleGuideEntry, WorldbuildingDoc, AppSettings) is defined here.
- **`src/db/database.ts`** — Dexie (IndexedDB) database class with table definitions and compound indexes. Singleton `db` export.
- **`src/db/operations.ts`** — All CRUD functions. Validates with Zod before writing. Cascading deletes for projects. Components never import Dexie directly.
- **`src/store/`** — Three Zustand stores using Immer middleware. `uiStore` (sidebar, modals, AI panel), `editorStore` (active document, dirty/save state, word count), `projectStore` (active project context). These hold only ephemeral UI state.
- **`src/hooks/`** — React hooks bridging Dexie and components via `useLiveQuery` from `dexie-react-hooks`. Data is reactively updated when IndexedDB changes.
- **`src/components/editor/`** — TipTap editor with `tiptap-markdown` for Markdown round-tripping. Content stored as Markdown strings in Dexie. The `ChapterEditor` component uses `"use no memo"` to opt out of the React Compiler due to TipTap's imperative DOM manipulation.
- **`src/lib/ai/`** — OpenRouter integration. `client.ts` calls `/api/ai` (Next.js route handler that proxies to OpenRouter). `prompts.ts` builds system prompts from story bible context. `serialize.ts` serializes story bible data for AI context. Six AI tools: generate-prose, review-text, suggest-edits, character-dialogue, brainstorm, summarize.
- **`src/lib/export/`** — Export pipeline for manuscripts. Supports Markdown, DOCX (via `docx` library), and PDF (via `pdfmake`). `gather.ts` collects chapter data, `markdown-to-nodes.ts` converts markdown to document nodes, and format-specific exporters (`exportMarkdown.ts`, `exportDocx.ts`, `exportPdf.ts`) produce downloadable files.

## Routing

```
/                                        — Dashboard (project picker)
/projects/[projectId]                    — Project overview (layout: sidebar + topbar)
/projects/[projectId]/chapters/[id]      — Chapter editor (TipTap)
/projects/[projectId]/bible              — Story bible overview
/projects/[projectId]/bible/characters   — Character list & [characterId] detail
/projects/[projectId]/bible/locations    — Location list & [locationId] detail
/projects/[projectId]/bible/timeline     — Timeline editor
/projects/[projectId]/bible/style-guide  — Style guide entries
/projects/[projectId]/bible/worldbuilding — Worldbuilding docs & [docId] editor
/api/ai                                  — POST proxy to OpenRouter
```

## Data Flow

**Editor:** Dexie → markdown string → TipTap (ProseMirror doc) → user edits → `editor.storage.markdown.getMarkdown()` → debounced auto-save → Dexie. Word count is denormalized on each save.

**AI:** Client gathers story bible context (characters, locations, style guide) → builds system prompt → POST `/api/ai` → proxied to OpenRouter → response displayed in AI panel.

## Conventions

- Entity IDs are UUIDv4 strings (`crypto.randomUUID()`). Timestamps are ISO 8601 strings.
- Cross-references between bible entries use UUID arrays (e.g., `linkedCharacterIds`), not join tables.
- `AppSettings` is a singleton row in IndexedDB (id = `"app-settings"`).
- TipTap storage access requires casting through `unknown` since the Storage type doesn't expose extension-specific properties.
