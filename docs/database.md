# Database

All entity data is stored in IndexedDB via Dexie. Components never import Dexie directly — they go through hooks (`src/hooks/data/`) or operations (`src/db/operations/`).

## Schemas (`src/db/schemas/`)

Zod is the single source of truth for every entity. `@/db/schemas` resolves to `src/db/schemas/index.ts`, a barrel that re-exports every domain module — components and operations always import from `@/db/schemas`, never from a domain file directly. Each schema exports both the schema (`FooSchema`) and the inferred type (`Foo`).

Domain modules:

- **`ids.ts`** — every branded entity-id schema (`ProjectIdSchema`, `ChapterIdSchema`, etc.) and its inferred id type. Other domain modules import the ids they need from here; `ids.ts` itself has no dependencies on other domain modules.
- **`shared.ts`** — cross-entity primitives: the `timestamp` schema and the `isSupportedImageSource` / `ImageSourceSchema` pair used for cover art and bible images.
- **`project.ts`** — `Project`, `ProjectMode`.
- **`chapter.ts`** — `Chapter` (binder fields), `Scene` (Model D scene metadata), `ChapterSnapshot`, `ChapterSummary`.
- **`bible.ts`** — `Character`, `CharacterRelationship`, `Location`, `TimelineEvent`, `StyleGuideEntry`, `GuardrailEntry`, `WorldbuildingDoc`, `EntityImage` (image attachments for bible entries).
- **`outline.ts`** — `OutlineGridColumn`, `OutlineGridRow`, `OutlineGridCell`, `OutlineCardColor`.
- **`writing.ts`** — `WritingSprint`, `WritingSession`, `PlaylistTrack`, `TrackSource`.
- **`ai.ts`** — `AgentDefinition`, `AgentModelOverride`, `AiProvider`, `ReasoningEffort` (see `docs/agents.md`), `SavedPrompt`, and `Comment` (chapter margin comments).
- **`settings.ts`** — `AppSettings`, `AppDictionary`, `ProjectDictionary`, and `normalizeAppSettings` (converts legacy per-provider API key fields to the current record format).
- **`brainstorm.ts`** — `BrainstormSetup`, `BrainstormColumn`, `BrainstormIdea`.
- **`search.ts`** — `IndexedChunk` (semantic retrieval).

`ChapterSummary` backs the `get:summary` read tool and is independent of the agent system despite living next to `Chapter`.

## Database (`src/db/database.ts`)

Dexie subclass with table definitions, compound indexes, and a singleton `db` export. The constructor applies **46 migration versions** by calling three functions from `src/db/migrations/`, each covering a version range and grouped by era:

- **`v01-v20.ts`** — the initial schema and its early additions (character/location detail fields, outline columns, sprints/sessions, playlist, comments, dictionaries, tool-calling settings).
- **`v21-v40.ts`** — settings/provider growth, the (now-removed) agent pipeline tables (v26–v29), the agents-table unification (v32–v33), threaded comments (v35), saved prompts (v36), the binder hierarchy (v37), brainstorm (v38), indexed chunks (v39), guardrails (v40).
- **`v41-plus.ts`** — global style guide/guardrail scope (v41), pipeline removal (v42), saved-prompt backfill (v43), scenes (v44), character summary (v45), project cover (v46).

Each file exports an `applyVxxToVyy(db: Dexie): void` function; `database.ts` calls all three in order before registering the `on("ready")` seed hook. Backfill functions that are unit-tested directly (`backfillBinderFieldsV37`, `backfillCoreScenesV44`, `backfillProjectCoverV46`) live in their era file and are re-exported from `database.ts` so `import { ... } from "./database"` keeps working.

v36 adds the `savedPrompts` table for the reusable prompt library. v37 adds binder fields to `chapters` (`parentChapterId`, `section`, `kind`, `includeInCompile`, `pageBreakBefore`) for the Scrivener-style nested binder — no index change, nesting is queried by JS-side filter like `worldbuildingDocs`; `backfillBinderFieldsV37` keeps legacy chapters as top-level manuscript documents. v42 removes the agent "pipeline" feature (chat-mode sub-agent delegation replaces it), dropping `agentRuns`, `readerBibleLog`, `readerBibleView`, `agentNotes`, `agentQuestions`, `workUnits`, `editPlans`, `proposedEdits`, `verifications`, and `snapshotManifests`. v44 adds the `scenes` table (see `docs/editor.md` for the scene model). When you add or change an entity:

1. Update the Zod schema in the relevant `src/db/schemas/*.ts` domain module (add a new module and export it from `index.ts` if none fits).
2. Add or update the Dexie table in `database.ts` and bump to a new `this.version(...).stores({...})` block in the current era's migration file (start a new era file once the current one grows unwieldy).
3. Add or extend the per-entity ops file in `src/db/operations/`.

## Operations (`src/db/operations/`)

One file per entity (22 entity files plus `helpers.ts`, `outline-sync.ts`, and `index.ts`). Every write validates with Zod; project deletes cascade through related tables.

Files:

```
agents.ts             brainstorm.ts        chapterSummaries.ts  chapters.ts
characters.ts         comments.ts          dictionary.ts        guardrails.ts
indexedChunks.ts      locations.ts         outline.ts           outline-sync.ts
playlist.ts           projects.ts          savedPrompts.ts      scenes.ts
scope.ts              settings.ts          snapshots.ts         sprints.ts
style-guide.ts        timeline.ts          worldbuilding.ts     helpers.ts
index.ts
```

`projects.ts` derives its project-scoped cascade (`deleteAllProjectData` / `deleteProject`) from a single `PROJECT_SCOPED_TABLES` list, computed from every Dexie table indexed by `projectId` minus a documented exemption list (`savedPrompts`, and the pre-v9 `outlineColumns`/`outlineCards` stores) — a new project-scoped table is cascaded automatically rather than needing both functions' hand-written lists kept in sync.

`helpers.ts` exports `generateId()` and `now()`, plus the shared order/CRUD primitives every entity file routes through instead of hand-rolling its own copy:

- `nextOrder(table, scope, explicitOrder, extraScope?)` — the next order value (max existing + 1, or 0) among rows matching `scope`, or `explicitOrder` if given. `scope` values may be `null` (falls back to a JS scan, since IndexedDB can't index a null key); `extraScope` narrows further within `scope` by an arbitrary predicate.
- `renumber(table, orderedIds, { touchUpdatedAt? })` — assigns `order` = index within `orderedIds` to every row in that sequence.
- `compact(table, rows, { touchUpdatedAt? })` — closes gaps in an already-sorted `rows` array so orders occupy a contiguous `0..n-1` range, skipping rows that are already correct.
- `reorderEntities(table, orderedIds)` — `renumber` wrapped in its own transaction; used by entities with no other order-adjacent writes.
- `createCrud(table)` — returns `{ get, delete }` for entities whose get/delete have no extra logic (no cascade, no validation). Not used for `db.agents` specifically: `operations/agents.ts` is imported by `database.ts` for the built-in agent seed, and a factory call at module scope there would dereference the table before `db` (which the factory closes over) is assigned.

None of `renumber`/`compact` touch `updatedAt` unless the caller passes `touchUpdatedAt: true` — each call site opts in exactly where the pre-consolidation code already bumped it (e.g. scene renumbering, chapter/scene moves), and stays silent where it didn't (plain reorders, outline-row/chapter order compaction after a delete).

## Chapter-outline sync (`src/db/operations/outline-sync.ts`)

Bidirectional sync between chapters and outline rows: creating a chapter creates a corresponding outline row, deleting a chapter cleans up the row, and edits stay in sync. Never duplicate this logic in components.

## Conventions

- Entity IDs are UUIDv4 strings (`crypto.randomUUID()`). Timestamps are ISO 8601 strings.
- Cross-references between bible entries use UUID arrays (e.g., `linkedCharacterIds`), not join tables.
- **Singleton rows:** `AppSettings` (id = `"app-settings"`), `AppDictionary` (id = `"app-dictionary"`).
