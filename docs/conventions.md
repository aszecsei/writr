# Conventions

Project-wide rules. Domain-specific conventions live with their docs (`docs/database.md`, `docs/editor.md`, etc.).

## IDs and timestamps

- Entity IDs are UUIDv4 strings (`crypto.randomUUID()`, exposed via `generateId()` in `src/db/operations/helpers.ts`).
- Timestamps are ISO 8601 strings, generated via `now()` in the same file.
- Cross-references between entities use **UUID arrays** (e.g., `linkedCharacterIds`), not join tables.
- **Singleton rows:** `AppSettings` (id = `"app-settings"`), `AppDictionary` (id = `"app-dictionary"`).

## Hooks

- Add new entity hooks via the factories in `src/hooks/factories.ts`. Don't write bespoke `useLiveQuery` calls.
- Hooks live in `src/hooks/<area>/`; pick the right area or add a new subdir before adding to root.

## TipTap

- Default ref-type extension options to `undefined` in `addOptions()` to prevent deep-merge from clobbering refs.
- `ChapterEditor` uses `"use no memo"` to opt out of the React Compiler.
- TipTap storage access requires casting through `unknown`.

## React Compiler

- `reactCompiler` is on. A hook passed as a value (a parameter, a variable, a property) must be named `use*` at the call site, or the compiler treats the call as a plain function and memoises it, which changes the hook order between renders. Import aliases keep their imported name, so `import { useX as dexieUseX }` is fine; a parameter named `dexieHook` is not.

## Stores

- Zustand stores hold **ephemeral UI state only**. Persistent data goes in Dexie.
- Use Immer drafts (`set((s) => { s.foo = ... })`).
- Never let two stores own the same state — pick the canonical owner.

## CSS and theming

- CSS custom properties: `--primary-*`, `--neutral-*`, `--editor-content-width`, `--density-*`.
- Custom Tailwind utilities: `py-density-item`, `py-density-button`, `gap-density`.
- Density is controlled by the `[data-density]` attribute on the document root.
- Theme application goes through `src/lib/theme/`, not raw `document.documentElement.style.setProperty`.

## Terminology

User-facing labels for project-mode-sensitive concepts (chapter vs. sequence, etc.) come from `src/lib/terminology.ts`. Don't hard-code "Chapter" in UI strings.

## Imports

- Use the `@/` alias for `src/*` imports, not relative paths beyond two levels.
- Biome enforces import ordering — let `npm run format` sort them.

## Comments in code

- Default to writing none. Add a comment only when the **why** is non-obvious (a hidden constraint, a workaround, a subtle invariant). Don't restate what the code does.
- Don't reference the current task, fix, or callers in code comments — that's PR-description territory.
