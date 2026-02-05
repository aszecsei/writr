# Writr

A privacy-first, local-first writing application for novelists and long-form fiction writers.

## Overview

Writr is a full-featured writing environment designed for authors working on novels, serials, and other long-form fiction. All data lives in your browser's local storage -- there are no accounts, no cloud sync, and no tracking. Writr gives you a distraction-free editor, a comprehensive story bible, AI-powered writing tools, analytics, and manuscript export, all without your words ever leaving your machine.

## Features

### Writing Editor

- Rich text editing powered by TipTap with content stored as Markdown
- Autosave with dirty-state indicator
- Live word count (per chapter and per project)
- Focus mode and typewriter scrolling for distraction-free writing
- Multiple font families including OpenDyslexic for accessibility
- Comments and annotations anchored to text selections or positions

### Story Bible

- **Characters** -- detailed profiles with custom fields, relationship graphs, and family trees
- **Locations** -- hierarchical location entries with descriptions and linked characters
- **Timeline** -- chronological event editor for tracking plot and story arcs
- **Style guide** -- entries for voice, terminology, and consistency rules
- **Worldbuilding documents** -- freeform rich-text documents for lore, magic systems, and more
- Cross-linking between all entity types via UUID references

### Outline Grid

A multi-dimensional planning tool for structuring your story:

- Configurable rows and columns (e.g., chapters vs. plot threads)
- Color-coded cells with rich text content
- Chapter linking to connect outline cells to actual chapters
- Templates for common outline structures

### AI Assistance

Seven writing tools powered by OpenRouter, with story bible context automatically included:

- **Generate prose** -- draft new passages from a prompt
- **Review text** -- get feedback on selected text
- **Suggest edits** -- receive inline revision suggestions
- **Character dialogue** -- generate in-character dialogue
- **Brainstorm** -- explore ideas and plot directions
- **Summarize** -- condense chapters or sections
- **Consistency check** -- flag contradictions against your story bible

### Analytics

- Writing session tracking with automatic start/stop detection
- Daily word count history and streak tracking
- Time-of-day productivity charts
- Writing sprints with configurable timer and word count goals

### Export

Export a single chapter or your full manuscript in multiple formats:

- Markdown
- DOCX
- PDF
- HTML (AO3-compatible)
- Clipboard copy

### Additional Features

- **Full-text search** across chapters, characters, locations, and all other entity types
- **Playlist** -- YouTube integration for writing ambiance playlists
- **Preview cards** -- generate shareable images of selected text passages
- **Multi-project support** -- dashboard with per-project metadata and target word count tracking

## Privacy

Writr is built around a simple principle: your writing belongs to you.

- All data is stored locally in your browser's IndexedDB. Nothing is sent to a server.
- There are no user accounts, no cloud storage, and no analytics or tracking.
- AI requests are proxied through a local Next.js API route. Your OpenRouter API key is stored in local settings and is only ever sent to OpenRouter's API.
- You can export your data at any time for backups or migration.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run start
```

### AI Features

AI tools require an [OpenRouter](https://openrouter.ai/) API key. Once the app is running, open Settings and enter your key. The key is stored locally and never leaves your browser except when making requests to OpenRouter.

## Development

### Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start development server             |
| `npm run build`    | Create production build              |
| `npm run start`    | Start production server              |
| `npm run lint`     | Run Biome linter                     |
| `npm run format`   | Format code with Biome               |
| `npm run test`     | Run tests (Vitest)                   |
| `npm run test:watch` | Run tests in watch mode            |

### Testing

Tests use [Vitest](https://vitest.dev/) with `fake-indexeddb` for IndexedDB mocking. Test files are colocated with their source files (e.g., `operations.test.ts` next to `operations.ts`).

### Linting and Formatting

The project uses [Biome](https://biomejs.dev/) for both linting and formatting with 2-space indentation.

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/) with React Compiler
- [TypeScript](https://www.typescriptlang.org/) (strict mode)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [TipTap](https://tiptap.dev/) (rich text editor)
- [Dexie](https://dexie.org/) (IndexedDB wrapper)
- [Zustand](https://zustand.docs.pmnd.rs/) (state management)
- [Zod](https://zod.dev/) (schema validation)
