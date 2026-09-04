# Collaboration

Real-time multi-user editing, end-to-end encrypted. The feature is **gated on the `NEXT_PUBLIC_COLLAB_URL` env var** — when unset, all collab UI is hidden.

## Components

```
src/lib/collab/         Client library (encryption, transport, session lifecycle)
src/components/collab/  UI: ShareDialog, CollabBanner, GuestSessionShell, …
src/store/collabStore   Session state, peer identity, approval queue
src/hooks/collab/       useCollabManager, useCommentsMeta
src/hooks/editor/       useCommentsAdapter
collab/                 Standalone WebSocket relay (separate Node service)
```

## Client library (`src/lib/collab/`)

- **`session.ts`, `lifecycle.ts`** — Session creation, join, leave, reconnect.
- **`handshake.ts`** — Key exchange and capability negotiation.
- **`crypto.ts`** — AES-GCM encryption. The encryption key lives in the URL fragment so it never reaches the relay.
- **`transport.ts`** — WebSocket transport with reconnect/backoff.
- **`protocol.ts`** — Wire-format messages.
- **`client.ts`** — High-level facade used by hooks and components.
- **`attach.ts`** — Wires a `CollabClient` into the collab store; used by `useCollabManager`.
- **`comments.ts`** — Comment sync layer that keeps Dexie comments aligned with Y.js positions.
- **`y-position.ts`** — ProseMirror ↔ Y.js position mapping.
- **`identity.ts`, `config.ts`** — Display name/color, env-driven config.

## Relay (`collab/`)

A small standalone Node service. **Blind pass-through** — it never sees plaintext.

- `src/room.ts` — Room state and message routing.
- `src/tokens.ts` — Role-based access tokens (`host`, `edit`, `review`, `view`).
- `src/rate-limit.ts` — Per-IP room-creation rate limit.
- `src/protocol.ts` — Wire format (mirrors the client).
- `src/index.ts` — HTTP + WebSocket entry point.
- See `collab/README.md` for deployment, env vars (`PORT`, `ALLOWED_ORIGINS`, `GRACE_PERIOD_MS`, …), and threat model.

The relay has **no persistent storage**; rooms exist only in memory and clear on restart.

## Editor integration

`ChapterEditor` (the host's local view) binds its own `@tiptap/extension-collaboration` and `@tiptap/extension-collaboration-caret` extensions over the session's Y.js doc when hosting. `CollabProseEditor` is guest-only — it backs the `/shared/[uuid]` route. Markdown round-tripping still happens for save/load; collab only changes the in-memory transport.

## UI flows

- **Host shares:** `ShareSessionButton` → `ShareDialog` → URL with key in the fragment.
- **Guest joins:** `DisplayNamePrompt` → `GuestSessionShell` wraps the editor.
- **Host approves:** `ApproveJoinDialog` (modal `collab-approve-join`) per join request.
- **Host manages:** `ManageParticipantsDialog` (modal `collab-manage-participants`).
- **Persistent banner:** `CollabBanner` shows session status and peers.

## Conventions

- Never log plaintext content from a collab session.
- Never persist a key from the URL fragment to storage.
- All collab UI must check `NEXT_PUBLIC_COLLAB_URL` (directly or via `useCollabManager`); when unset, it should render nothing.
- When touching collab UI, **add snapshot tests with the env var unset** to lock in the disabled-feature baseline (see `docs/testing.md`).
