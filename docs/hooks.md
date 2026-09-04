# Hooks

`src/hooks/` bridges Dexie and React via `useLiveQuery`, plus encapsulates editor and form lifecycles. **Don't write custom `useLiveQuery` calls** for new entities — use the factories.

## Factory pattern (`src/hooks/factories.ts`)

- `createEntityHook(table)` — single-row by id.
- `createProjectListHook(table, sortField)` — sorted list scoped to a project.
- `createProjectListUnsortedHook(table)` — unsorted list scoped to a project.
- `createChildListHook(table, parentField, sortField, options?)` — sorted list
  scoped to a non-project parent key (e.g. a chapter's snapshots, comments, or
  scenes). Pass `{ reverse: true }` to sort descending.

Use these whenever a new Dexie table needs a hook. They handle subscription, suspense-friendly defaults, and consistent return shapes.

## Data source (`src/context/DataSourceContext.tsx`, `src/hooks/data/source.ts`)

Project pages can render against two different backing stores: the user's
local Dexie database, or (for a shared-project guest) the in-memory
`useSharedProjectStore` synced from the host's project Y.Doc. `DataSource` is
`{ kind: "dexie" }` or `{ kind: "shared"; roomUuid }`, provided via
`DataSourceProvider` (the shared-project layout is the only place that
overrides the default `"dexie"` value).

- `useDataSource()` — reads the current `DataSource`.
- `useReadOnly()` — true when `kind === "shared"`; the shared-project guest
  view is always read-only.
- `useProjectHref(projectId)` — URL prefix (no trailing slash) for links
  within the current project, resolving to `/projects/[id]` or
  `/shared/[roomUuid]/projects/[id]` depending on the source.

`src/hooks/data/source.ts` re-exports source-aware versions of the
project-bible hooks (`useChapter`, `useChaptersByProject`, `useProject`,
`useCharacter`, `useCharactersByProject`, `useLocation`,
`useLocationsByProject`, `useTimelineByProject`, `useStyleGuideByProject`,
`useGuardrailsByProject`, `useRelationshipsByProject`). Each reads from Dexie
or from `useSharedProjectStore` depending on `useDataSource()`, built on two
internal generics: `useSourcedEntity` (single row by id) and
`useSourcedList` (project-scoped list). Components that render on both the
host and shared-guest routes (`src/components/projects/*Body.tsx`) must
import these from `@/hooks/data/source`, not the plain Dexie hooks — a guest
has no local Dexie data for the host's project, so a Dexie-only hook silently
returns nothing instead of the synced value. Scenes have no shared-doc
equivalent; guest-side scene sidebars are hidden by passing `null` in place
of the project id.

## Subdirectories

### `data/` — Dexie data hooks

`useChapter`, `useProject`, `useBibleEntries`, `useAppSettings`, `useSnapshots`, `useDictionary`, `usePlaylistEntries`, plus the agent-definition hooks (`useAgents`). `source.ts` holds the source-aware re-exports described above.

### `analysis/` — Text analysis

`useTextAnalysis` — sentence-level prose analysis (readability, hole counts) for a chapter or project scope.

### `editor/` — Editor lifecycle hooks

`useAutoSave`, `useComments`, `useEditorCommentSync`, `useEditorSpellcheck`, `useEditorKeyboardShortcuts`, `useFocusMode`, `useWritingStats`, `useAppStats`, `useHighlightFade`.

### `forms/` — Form hooks

`useCharacterForm`, `useLocationForm`, `useInlineEdit`.

### `outline/` — Outline grid

`useOutlineGrid`, `useOutlineGridDragDrop`, `useOutlineGridOperations`.

### `writing/` — Writing sprints

`useWritingSprint`, `useSprintHistory`.

### `ui/` — UI hooks

`useFocusModeShortcuts`, `useAutoLayout`, `useSearch`, `useSearchPage`. Binder sidebar: `useBinderDragDrop` (chapter-tree drag-and-drop — the optimistic flattened list, depth projection, and `moveChapter` commit), `useSceneDragDrop` (Model D scene drag-and-drop — drop-target tracking and the reorder/move-across-chapters commit), `useBinderRename` (inline chapter-rename state).

### `ai/` — AI panel hooks

`useDelegationHost` (builds the `DelegationHost` a chat agent's `agentContext.delegation` uses to run `delegate` sub-agents and `present_choice` prompts), `usePendingGates` (the `pendingGates` bar's state — `pushGate`/`resolveGate`/`resetGates` for gates bubbled up from sub-agent runs), `useAgentRun` (one run's loading/error/elapsed-time/abort lifecycle plus the per-tool approval gate).

### `collab/` — Collab session integration

`useCollabManager`, `useCommentsAdapter`, `useCommentsMeta`.

### Root

`factories.ts`, `useClickOutside.ts`.
