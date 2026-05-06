# Testing

Vitest with `fake-indexeddb` for IndexedDB mocking. Tests are colocated with source — `operations.test.ts` sits next to `operations.ts`.

## Commands

- `npm run test` — Run the suite once (`vitest run`).
- `npm run test:watch` — Watch mode (`vitest`).

Single file or filter: `npx vitest run path/to/file.test.ts` or `npx vitest run -t "name fragment"`.

## Configuration

- **Config:** `vitest.config.ts`.
- **Default environment:** `node`.
- **Component / DOM tests:** opt in by adding `// @vitest-environment jsdom` at the top of the file.
- **Setup files:**
  - `src/test/setup.ts` — wires `fake-indexeddb` (so Dexie just works in tests).
  - `src/test/setup-dom.ts` — adds `@testing-library/jest-dom` matchers.

## Component / snapshot tests

Use `@testing-library/react`'s `render` with the `toMatchSnapshot()` matcher. Snapshots live under `__snapshots__/` next to the test file.

**Env-gated features:** Some features (e.g., collab) are gated on env vars like `NEXT_PUBLIC_COLLAB_URL`. When you touch UI that's affected by such gating, **add a snapshot of the gated UI surface with the var unset** so a future change can't accidentally leak the gated UI when the feature is disabled.

## Test helpers (`src/test/helpers.ts`)

Factory functions for building entities in tests: `makeChapter()`, `makeCharacter()`, `makeRelationship()`, etc. **Use these instead of constructing entities by hand** — they keep tests resilient when schemas grow.

Use them with the operations API to seed Dexie:

```ts
import { makeChapter } from "@/test/helpers";
import { createChapter } from "@/db/operations";

await createChapter(makeChapter({ projectId, title: "Ch. 1" }));
```

## Patterns

- **Operations / hooks:** test against a real `db` with `fake-indexeddb`. Don't mock Dexie.
- **Stores:** create a fresh store instance per test (Zustand stores are modules; reset via the store's exported `reset`/`set` if available, or by re-importing).
- **Streaming AI tests:** use `src/lib/ai/build-messages.test.ts` and adapter tests as reference for how to drive the streaming generator.
