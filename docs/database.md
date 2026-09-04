# Database

All entity data is stored in IndexedDB via Dexie. Components never import Dexie directly — they go through hooks (`src/hooks/data/`) or operations (`src/db/operations/`).

## Schemas (`src/db/schemas.ts`)

Zod is the single source of truth for every entity. The schema file exports both the schema (`FooSchema`) and the inferred type (`Foo`).

**Core entities**

`Project`, `Chapter`, `Character`, `CharacterRelationship`, `Location`, `TimelineEvent`, `StyleGuideEntry`, `WorldbuildingDoc`, `EntityImage` (image attachments for bible entries).

**Outline grid**

`OutlineGridColumn`, `OutlineGridRow`, `OutlineGridCell`.

**Writing tooling**

`WritingSprint`, `WritingSession`, `PlaylistTrack`, `TrackSource`, `ChapterSnapshot`, `Comment`.

**Settings & dictionaries**

`AppSettings`, `AppDictionary`, `ProjectDictionary`.

**Agent system** (see `docs/agents.md`)

`AgentDefinition`, `AgentModelOverride`. `ChapterSummary` (cached per-chapter summaries) is also defined here; it backs the `get:summary` read tool and is independent of agents.

## Database (`src/db/database.ts`)

Dexie subclass with table definitions, compound indexes, and **46 migration versions**. Singleton `db` export. v36 adds the `savedPrompts` table for the reusable prompt library. v37 adds binder fields to `chapters` (`parentChapterId`, `section`, `kind`, `includeInCompile`, `pageBreakBefore`) for the Scrivener-style nested binder — no index change, nesting is queried by JS-side filter like `worldbuildingDocs`; `backfillBinderFieldsV37` keeps legacy chapters as top-level manuscript documents. v42 removes the agent "pipeline" feature (chat-mode sub-agent delegation replaces it), dropping `agentRuns`, `readerBibleLog`, `readerBibleView`, `agentNotes`, `agentQuestions`, `workUnits`, `editPlans`, `proposedEdits`, `verifications`, and `snapshotManifests`. v44 adds the `scenes` table (see `docs/editor.md` for the scene model). When you add or change an entity:

1. Update the Zod schema in `schemas.ts`.
2. Add or update the Dexie table in `database.ts` and bump to a new `this.version(...).stores({...})` block.
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
