# State (Zustand stores)

All Zustand stores use Immer middleware and are intended for **ephemeral UI state only** — persistent data lives in Dexie. Each store is in `src/store/`.

## Stores

- **`uiStore`** — sidebar (`open` + active panel: `chapters | bible | agents`), modal (discriminated union — see below), AI panel toggle, focus-mode toggle.
- **`editorStore`** — active document, dirty/save state, word count, selection, content version (used to invalidate derived state).
- **`projectStore`** — active project context (id, title, mode).
- **`commentStore`** — selected comment, comment-margin visibility.
- **`sprintStore`** — active sprint timer, word tracking.
- **`spellcheckStore`** / **`grammarStore`** — enabled state (spellcheck) / persisted-in-AppSettings enabled state (grammar), ignored keys, context menu, scanner state. Both build on the shared `createCheckerSlice` in `src/store/createCheckerStore.ts` (context menu, scanner current-index + items, ignored-keys set, wraparound `next`/`prev`/`removeAt`, `addToIgnored`) and add their own domain-specific fields on top.
- **`findReplaceStore`** — search/replace terms, regex/case/whole-word modes, match tracking.
- **`radioStore`** — playlist playback (queue, volume, shuffle, loop). **Persisted** to localStorage.
- **`collabStore`** — collab session state, connection lifecycle, peer identity, share URLs, approval queue.

## Modal system

`uiStore.modal` is a single discriminated union (`ModalState` in `src/store/uiStore.ts`). Open via `openModal({ id, ... })`, close via `closeModal()`. Exactly one modal renders at a time. Each modal component reads `modal` itself and early-returns `null` when its `id` doesn't match — a modal is never gated on a boolean prop from its parent.

Variants (id values):

```
create-project           edit-project            delete-project
project-settings         app-settings            export
preview-card             link-editor             insert-image
ruby-editor              dictionary-manager       grammar-rules
version-history          chapter-properties       separator-settings
saved-prompts            shortcuts-help           share-collab-session
collab-approve-join      collab-manage-participants
spellcheck-scanner       grammar-scanner
sprint-config            sprint-history            outline-template
add-relationship         add-image                 image-lightbox
import-backup
```

The `null` variant (`{ id: null }`) means "closed". When adding a modal, extend the union; the discriminated type forces every call site to pass the right payload.

### Mounting

`GlobalModals` (`src/components/providers/GlobalModals.tsx`) mounts every app-wide modal once, itself rendered once from `AppProviders` — above `AppShell` in the tree, so it covers every route without `AppShell` needing its own copy. The exceptions are modals scoped to a single page or component that already owns the data they need: `create-project` / `edit-project` / `delete-project` (dashboard and brainstorm pages), and `add-relationship` / `add-image` / `image-lightbox` (the family-tree page and `ImageGallery`).

`AppShell`'s focus-mode branch renders a simplified layout (no `TopBar`, sidebar, or editor toolbars) but does **not** mount a second `GlobalModals`. Instead, `GlobalModals` hides the modals only reachable from UI that focus mode itself hides — `export` and `preview-card` (opened from the `TopBar`/toolbars) and the collab dialogs `share-collab-session` / `collab-approve-join` / `collab-manage-participants` (opened from the `TopBar`/`CollabBanner`) — behind `!focusModeEnabled`. When a new modal is likewise only reachable from chrome that focus mode hides, add it to that same block rather than reintroducing a second modal list.

## Conventions

- Don't add a store for state that belongs in Dexie. If it survives a page refresh, it lives in the database.
- Don't add a store for state that belongs in component-local `useState`. If only one component reads it, leave it local.
- Use Immer drafts (`set((s) => { s.foo = ... })`), not spread copies.
