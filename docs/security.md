# Security

Writr is a local-first, single-user app with one optional multi-user surface (collaboration). This doc captures what the app protects, what it doesn't, and how the collab feature stays end-to-end-encrypted in spite of routing through a relay.

## Posture at a glance

- **No backend for user content.** Every entity (projects, chapters, characters, comments, agent runs, snapshots, settings) lives in the browser's IndexedDB. Nothing is uploaded anywhere unless the user explicitly enables AI or collab.
- **One server route.** `/api/ai` is the only server-side endpoint. It is a stateless proxy that forwards to the user-chosen LLM provider. There is no auth, no database, no logging of message bodies.
- **E2E encryption for collab.** When collab is enabled, the relay sees only ciphertext, room UUIDs, role tokens, and message envelope types. Document content, comments, display names, and the encryption key never reach the server.
- **No telemetry.** The app does not phone home.

## Local data

All entity data is stored in IndexedDB via Dexie (see `docs/database.md`). Implications:

- The data is as safe as the browser profile it lives in. There is no server-side encryption-at-rest because there is no server side.
- Anyone with access to the OS user profile can read the database. Treat shared machines accordingly.
- Backup/export goes through `src/lib/backup/`; backups are plaintext JSON. Don't commit them or upload them anywhere you wouldn't paste plaintext.
- No cookies, no auth tokens, no session — there is no user account.

## AI route (`/api/ai`)

- Request body is validated with Zod (`AiRequestSchema` in `src/app/api/ai/route.ts`); unknown providers are rejected at parse time via `AiProviderEnum`.
- The user's API key is sent in the request body and forwarded to the provider's SDK on the server. **The key is not stored, logged, or cached.** Logs only include status codes, error messages, and the upstream error body when present (`logUpstreamError`).
- Responses can be streamed (SSE). The first iteration is driven before the SSE stream is opened, so upstream 4xx/5xx errors come back as JSON instead of half-streamed broken pipes.
- The route does no rate-limiting or auth of its own; if you deploy this publicly behind your own infrastructure, put auth and rate-limiting in front of it.
- API keys are persisted client-side in `AppSettings.providerApiKeys` (IndexedDB). They never leave the user's browser except as the `apiKey` field in calls to `/api/ai`.

## Collaboration

The collab feature is **gated on `NEXT_PUBLIC_COLLAB_URL`**. When unset, all collab UI is hidden and no collab code paths run. See `docs/collab.md` for the architectural overview.

### Trust model

The relay (`collab/`) is **trusted to route messages honestly, not to keep secrets**. Even a fully compromised relay must not be able to read document content. Defense-in-depth lives on the client: decrypted Y.js updates are validated against the ProseMirror schema before being applied.

What the relay knows:

- Room UUIDs (random, no chapter or user identifiers).
- Per-token role assignments (`view` | `review` | `edit` | `host`).
- Number of connected sockets per room.
- Message envelope types (`y-update`, `awareness`, …) — for role gating only.
- Encrypted payload sizes.

What the relay never sees:

- Document content (Y.js updates and awareness payloads are AES-GCM ciphertext).
- Chapter / character / location names, comments, story bible content.
- User display names (transmitted inside encrypted awareness payloads).
- The room encryption key (lives in the share-link URL fragment, which browsers do not send to servers).

The relay has **no persistent storage**. Rooms exist only in memory and clear on restart.

### Cryptography

Implemented in `src/lib/collab/crypto.ts` using the WebCrypto API.

- **Symmetric encryption:** AES-GCM with a 256-bit room key and a 12-byte random IV per message.
- **Key exchange:** X25519 ECDH between host and each guest. Host's long-term-ish public key is published to guests via the URL fragment of the share link (`#h=<base64url>`); guests generate an ephemeral keypair per join.
- **Key wrapping:** The shared X25519 secret is run through HKDF-SHA256 (salt = room UUID, info = `"writr.collab.roomKeyWrap.v1"`) to derive a per-pair AES-GCM wrap key. The room key is wrapped with that key in `join-approved` payloads.
- **Ciphertext framing:** `iv || ciphertext`, base64url-encoded.

The room key is never sent in the clear. The relay sees only opaque base64 blobs.

### Share-link layout

```
https://app.example.com/shared/<roomUuid>?t=<token>#h=<hostPubEncoded>[&p=1]
```

- `t` (query string): role token. The relay reads this to authorize and assign a role.
- `#h` (URL fragment): host's X25519 public key. Browsers do not send fragments in HTTP requests, so this never reaches the server.
- `&p=1` (URL fragment, optional): project-mode flag — guest router mounts the project shell instead of the active-chapter editor. In the fragment so the relay does not learn share scope.

### Roles and gating

Roles are enforced by one `canSend(role, message)` in `collab/src/protocol.ts` — the single source of truth for the wire protocol, re-exported to the Next app as `src/lib/collab/protocol.ts` via the `@collab/*` path alias. The relay calls it server-side (authoritative); `CollabClient` calls the same function client-side to pre-empt sends the server would reject:

| Role | Prose Y-update | Comments Y-update | Project Y-update | Join approve/deny / kick |
|---|---|---|---|---|
| `view` | ✗ | ✗ | ✗ | ✗ |
| `review` | ✗ | ✓ | ✗ | ✗ |
| `edit` | ✓ | ✓ | ✗ | ✗ |
| `host` | ✓ | ✓ | ✓ | ✓ |

Awareness is open to all roles. Project Y-updates are host-only — guests in project mode get a read-only mirror of the host's project Dexie state via `ProjectMirror` / `ProjectReader`.

### Tokens and rate limits (relay)

- `POST /rooms` mints a `hostToken` (most sensitive — anyone with it can claim the host role) plus invite tokens for each guest role (`edit`, `review`, `view`). Invite tokens grant their role to anyone who has them.
- Tokens are 32 random bytes (`randomBytes(32)`, base64url) and compared in **constant time** via `timingSafeEqual` (`collab/src/tokens.ts`).
- WebSocket payloads are capped at 256 KB; the WebSocket server enforces `maxPayload`, and the room enforces a per-`docKind` buffer cap of 4 MB.
- Per-IP rate limit on room creation (`ROOM_CREATE_PER_HOUR`, default 5).
- Origin allowlist enforced on both HTTP and WebSocket handshakes (`ALLOWED_ORIGINS`); empty list denies all.
- Idle rooms (`IDLE_TIMEOUT_MS`, default 30 min with no messages) are torn down. Host disconnects start a `GRACE_PERIOD_MS` (default 60 s) before the room ends, so a transient drop doesn't kick guests.
- IPs appear only in the in-memory rate-limit counter and are not persisted or logged.
- Logs are structured JSON without payloads, document content, or display names.

### Client-side key persistence

- The host's X25519 private key is **not persisted**. It lives only in memory for the duration of the session; a page reload requires re-minting a room and re-handshaking.
- The display name is persisted in `localStorage` (`writr.collab.displayName`) for convenience — it survives across sessions.
- The room key (the AES-GCM key delivered via the share fragment) is **never** written to any storage. It lives only in memory for the duration of the session.

### Required hygiene when touching collab code

- Never log plaintext content from a collab session.
- Never persist a key from the URL fragment to storage.
- All collab UI must check `NEXT_PUBLIC_COLLAB_URL` (directly or via `useCollabManager`); when unset, render nothing.
- When touching collab UI, **add snapshot tests with the env var unset** to lock in the disabled-feature baseline (see `docs/testing.md`).

## Out of scope / known non-goals

- **Encryption-at-rest for IndexedDB.** OS-level disk encryption is the user's responsibility.
- **Auth for `/api/ai`.** The route trusts its caller; deploy your own gateway if exposing it publicly.
- **Forward secrecy across sessions.** Each session uses a fresh room key, but a compromised session key reveals all updates exchanged in that session. Y.js does not natively support intra-session key rotation.
- **Defense against a malicious host.** A host with `edit` peers is implicitly trusted by those peers — they share document state. The threat model treats the host as the data owner.
- **Anonymity from peers.** Guests' display names are visible to all other peers in the same session (encrypted to the relay, plaintext to peers).
