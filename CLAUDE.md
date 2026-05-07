# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repo. The detailed docs are split into topic files under `docs/` — read the area you're touching before making changes.

## Commands

- `npm run dev` — Dev server on `localhost:3000`.
- `npm run build` — Production build.
- `npm run start` — Start the production server.
- `npm run lint` — `biome check`.
- `npm run format` — `biome format --write`.
- `npm run test` — `vitest run`.
- `npm run test:watch` — `vitest`.

## Topic docs

Read the docs that match the area you're touching:

- [`docs/architecture.md`](docs/architecture.md) — Stack, top-level layout, data flow at a glance.
- [`docs/database.md`](docs/database.md) — Dexie database, Zod schemas, per-entity operations, migrations.
- [`docs/state.md`](docs/state.md) — Zustand stores and the modal discriminated union.
- [`docs/hooks.md`](docs/hooks.md) — Hook directories and the `createEntityHook` / `createProjectListHook` factories.
- [`docs/editor.md`](docs/editor.md) — TipTap editor, custom extensions (prose + screenplay), comments.
- [`docs/components.md`](docs/components.md) — Component directories and the reusable primitives in `src/components/ui/`.
- [`docs/routing.md`](docs/routing.md) — App Router pages and the single `/api/ai` route.
- [`docs/ai.md`](docs/ai.md) — AI client, providers, adapters, prompts, tool-calling registry.
- [`docs/agents.md`](docs/agents.md) — Agent definitions, runs, builtins, pipeline (reader / editor / verifier).
- [`docs/collab.md`](docs/collab.md) — End-to-end-encrypted collab feature and the standalone relay.
- [`docs/security.md`](docs/security.md) — Security posture, threat model, and the collab cryptography (AES-GCM, X25519, HKDF, fragment-only room key).
- [`docs/lib.md`](docs/lib.md) — Other libraries (export, spellcheck, search, backup, theme, fountain, terminology, …).
- [`docs/testing.md`](docs/testing.md) — Vitest setup, fake-indexeddb, snapshots, test helpers.
- [`docs/conventions.md`](docs/conventions.md) — Project-wide conventions (IDs, CSS vars, hooks, comments).

## Critical always-on rules

- **All entity data lives in IndexedDB.** Pages are `"use client"`. The only server route is `/api/ai`.
- **Schemas first.** Add or change a Zod schema in `src/db/schemas.ts` before touching tables, operations, or UI.
- **Components don't import Dexie.** Go through `src/hooks/data/` or `src/db/operations/`.
- **Use the hook factories.** `createEntityHook` / `createProjectListHook` in `src/hooks/factories.ts` — don't write bespoke `useLiveQuery` calls.
- **Reuse UI primitives.** Check `src/components/ui/` (`Modal`, `ConfirmDialog`, `ContextMenu`, `DialogFooter`, `AutoResizeTextarea`, `TriStateCheckbox`, plus `button-styles.ts` / `form-styles.ts`) before building new components.
- **One modal at a time.** `uiStore.modal` is a discriminated union; extend it and use `openModal()` / `closeModal()`.
- **Stores hold ephemeral UI state only.** If state survives a refresh, it belongs in Dexie.
- **Use `terminology.ts`** for user-facing labels that change between prose and screenplay modes — don't hard-code "Chapter".
- **Test gated UI both ways.** Features gated on env vars (e.g., `NEXT_PUBLIC_COLLAB_URL`) need snapshots with the var unset to lock in the disabled-feature baseline.

## Agent skills

### Issue tracker

GitHub issues at `aszecsei/writr`, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
