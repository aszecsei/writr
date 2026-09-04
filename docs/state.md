# State (Zustand stores)

All Zustand stores use Immer middleware and are intended for **ephemeral UI state only** — persistent data lives in Dexie. Each store is in `src/store/`.

## Stores

- **`uiStore`** — sidebar (`open` + active panel: `chapters | bible | agents`), modal (discriminated union — see below), AI panel toggle, focus-mode toggle.
- **`editorStore`** — active document, dirty/save state, word count, selection, content version (used to invalidate derived state).
- **`projectStore`** — active project context (id, title, mode).
- **`commentStore`** — selected comment, comment-margin visibility.
- **`sprintStore`** — active sprint timer, word tracking, config & history modal state.
- **`spellcheckStore`** — enabled state, ignored words, context menu, scanner state.
- **`findReplaceStore`** — search/replace terms, regex/case/whole-word modes, match tracking.
- **`radioStore`** — playlist playback (queue, volume, shuffle, loop). **Persisted** to localStorage.
- **`collabStore`** — collab session state, connection lifecycle, peer identity, share URLs, approval queue.

## Modal system

`uiStore.modal` is a single discriminated union (`ModalState` in `src/store/uiStore.ts`). Open via `openModal({ id, ... })`, close via `closeModal()`. Exactly one modal renders at a time, hosted by `AppShell`.

Variants (id values):

```
create-project           edit-project           delete-project
project-settings         app-settings           export
preview-card             link-editor            insert-image
ruby-editor              dictionary-manager     version-history
share-collab-session     collab-approve-join    collab-manage-participants
```

The `null` variant (`{ id: null }`) means "closed". When adding a modal, extend the union; the discriminated type forces every call site to pass the right payload.

## Conventions

- Don't add a store for state that belongs in Dexie. If it survives a page refresh, it lives in the database.
- Don't add a store for state that belongs in component-local `useState`. If only one component reads it, leave it local.
- Use Immer drafts (`set((s) => { s.foo = ... })`), not spread copies.
