# Hooks

`src/hooks/` bridges Dexie and React via `useLiveQuery`, plus encapsulates editor and form lifecycles. **Don't write custom `useLiveQuery` calls** for new entities — use the factories.

## Factory pattern (`src/hooks/factories.ts`)

- `createEntityHook(table)` — single-row by id.
- `createProjectListHook(table, sortField)` — sorted list scoped to a project.
- `createProjectListUnsortedHook(table)` — unsorted list scoped to a project.

Use these whenever a new Dexie table needs a hook. They handle subscription, suspense-friendly defaults, and consistent return shapes.

## Subdirectories

### `data/` — Dexie data hooks

`useChapter`, `useProject`, `useBibleEntries`, `useAppSettings`, `useSnapshots`, `useDictionary`, `usePlaylistEntries`, plus agent-system hooks (`useAgents`, `useAgentRun`, `useAgentNotes`, `useReaderBible`, `useVerifications`, `usePlan`).

### `editor/` — Editor lifecycle hooks

`useAutoSave`, `useComments`, `useEditorCommentSync`, `useEditorSpellcheck`, `useEditorKeyboardShortcuts`, `useFocusMode`, `useWritingStats`, `useAppStats`, `useHighlightFade`.

### `forms/` — Form hooks

`useCharacterForm`, `useLocationForm`, `useInlineEdit`.

### `outline/` — Outline grid

`useOutlineGrid`, `useOutlineGridDragDrop`, `useOutlineGridOperations`.

### `writing/` — Writing sprints

`useWritingSprint`, `useSprintHistory`.

### `ui/` — UI hooks

`useFocusModeShortcuts`, `useAutoLayout`, `useSearch`, `useSearchPage`.

### `collab/` — Collab session integration

`useCollabManager`, `useCommentsAdapter`, `useCommentsMeta`.

### Root

`factories.ts`, `useClickOutside.ts`.
