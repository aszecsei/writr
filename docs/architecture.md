# Architecture

Writr is a long-form writing app for both prose and screenplays. It supports multi-project libraries, chapter-based rich-text editing, a story bible, an outline grid, AI integration via multiple providers, agent-driven manuscript review, and (optionally) end-to-end-encrypted real-time collaboration.

## Stack

- **Framework:** Next.js 16 App Router (`src/app/`), React 19 with the React Compiler enabled. TypeScript strict mode.
- **Client-only data:** All entity data lives in IndexedDB (Dexie), so every route page is `"use client"`. The only server route is `/api/ai`, which proxies to LLM providers.
- **Styling:** Tailwind CSS v4 via PostCSS. Theme tokens in `src/app/globals.css`.
- **Linting/formatting:** Biome (not ESLint/Prettier). 2-space indentation. Import organization is enforced. Tailwind directives are enabled in the CSS parser.
- **Path alias:** `@/*` maps to `./src/*`.

## Notable libraries

- **Editor:** `@tiptap/react` v3 + `tiptap-markdown` for Markdown round-tripping.
- **Database:** `dexie` + `dexie-react-hooks` (`useLiveQuery`).
- **State:** `zustand` + `immer` middleware.
- **Schemas:** `zod` (single source of truth for all entity shapes).
- **AI providers:** `@anthropic-ai/sdk`, `openai`, `@google/genai`.
- **Drag-and-drop:** `@dnd-kit/react`.
- **Diagrams:** `@xyflow/react` (family tree).
- **Layout:** `react-resizable-panels`.
- **Spellcheck:** `nspell` with CDN-loaded dictionaries.
- **Markdown / diff:** `marked`, `diff`.
- **Media:** `react-player` (YouTube playlist).
- **Image capture:** `html2canvas` (preview cards).
- **Export:** `docx`, `pdfmake`.
- **Screenplay:** `fountain-js` plus an in-house parser/serializer in `src/lib/fountain/`.
- **Pattern matching:** `ts-pattern`.

## High-level structure

```
src/
  app/         Next.js routes (all "use client") and the /api/ai handler
  components/  Feature components, organized by domain (19 subdirectories)
  db/          Dexie database, Zod schemas, per-entity operations
  hooks/       React hooks bridging Dexie ↔ components (useLiveQuery factories)
  lib/         Pure-ish libraries (ai, agents, collab, export, search, …)
  store/       Zustand stores for ephemeral UI state
  test/        Vitest setup, factories, helpers
collab/        Standalone WebSocket relay (separate Node service)
```

## Data flow at a glance

- **Editor:** Dexie → Markdown string → TipTap (ProseMirror doc) → user edits → `editor.storage.markdown.getMarkdown()` → debounced auto-save → Dexie. Word count is denormalized on save.
- **AI:** Client gathers story-bible context → builds messages → POST `/api/ai` → server proxies to the chosen provider → streamed response surfaced in the AI panel.
- **Comments:** Stored with `fromOffset`/`toOffset` (1-indexed ProseMirror positions). The `Comments` extension maps positions through doc changes via ProseMirror `Mapping`.
- **Collab (optional):** When `NEXT_PUBLIC_COLLAB_URL` is set, the editor swaps into a Y.js-backed `CollabProseEditor` and joins a session through the relay in `collab/`.
