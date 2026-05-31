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

`AgentDefinition`, `AgentModelOverride`, `AgentReference`, `AgentRun`, `AgentRunUsage`, `AgentNote`, `AgentQuestion`, `WorkUnit`, `WorkUnitPlacement`, `EditPlan`, `EditPlanTier`, `ProposedEdit`, `Verification`, `VerificationFinding`, `ReaderPass`, `ReaderBibleLogEntry`, `ReaderBibleViewEntry`, `ChapterSummary`, `SnapshotManifest`.

## Database (`src/db/database.ts`)

Dexie subclass with table definitions, compound indexes, and **35 migration versions**. Singleton `db` export. v35 adds `parentCommentId` (indexed) to the `comments` store for threaded replies. When you add or change an entity:

1. Update the Zod schema in `schemas.ts`.
2. Add or update the Dexie table in `database.ts` and bump to a new `this.version(...).stores({...})` block.
3. Add or extend the per-entity ops file in `src/db/operations/`.

## Operations (`src/db/operations/`)

One file per entity (24 entity files plus `helpers.ts` and `index.ts`). Every write validates with Zod; project deletes cascade through related tables.

Files:

```
agentNotes.ts        agentQuestions.ts    agentRuns.ts         agents.ts
chapters.ts          characters.ts        chapterSummaries.ts  comments.ts
dictionary.ts        editPlans.ts         locations.ts         outline.ts
playlist.ts          projects.ts          proposedEdits.ts     readerBible.ts
settings.ts          snapshotManifests.ts snapshots.ts         sprints.ts
style-guide.ts       timeline.ts          verifications.ts     workUnits.ts
worldbuilding.ts     helpers.ts           index.ts
```

`helpers.ts` exports `generateId()` and `now()`. The legacy `src/db/operations.ts` (singular) re-exports the directory for back-compat.

## Chapter-outline sync (`src/db/chapter-outline-sync.ts`)

Bidirectional sync between chapters and outline rows: creating a chapter creates a corresponding outline row, deleting a chapter cleans up the row, and edits stay in sync. Never duplicate this logic in components.

## Conventions

- Entity IDs are UUIDv4 strings (`crypto.randomUUID()`). Timestamps are ISO 8601 strings.
- Cross-references between bible entries use UUID arrays (e.g., `linkedCharacterIds`), not join tables.
- **Singleton rows:** `AppSettings` (id = `"app-settings"`), `AppDictionary` (id = `"app-dictionary"`).
