# writr-collab

Thin WebSocket relay for Writr's E2E-encrypted collaboration sessions.

This service is a **blind relay**. It routes encrypted messages between a host and guests but cannot decrypt document content. All confidentiality comes from a symmetric key that lives only in the URL fragment of share links — the server never sees it.

## What the relay knows vs. doesn't know

**Knows:**
- Room UUIDs (random, no chapter/user identifiers)
- Per-token role assignments (`view` | `review` | `edit` | `host`)
- Number of connected sockets per room
- Message types (`y-update`, `awareness`, `meta`, etc.) — for role gating only
- Encrypted payload sizes

**Doesn't know:**
- Document content (Yjs updates are AES-GCM ciphertext)
- Chapter IDs, character/location names, comments
- User display names (transmitted inside encrypted awareness payloads)
- The encryption key (lives in the URL fragment)

No persistent storage. No database. Process restart wipes all rooms.

## Run locally

```sh
npm install
npm run dev          # tsx watch
# or
npm run build && npm start
```

Defaults to `0.0.0.0:4444`. Configure via env vars:

| Var | Default | Notes |
|---|---|---|
| `PORT` | `4444` | |
| `HOST` | `0.0.0.0` | |
| `ALLOWED_ORIGINS` | *(empty — denies all)* | Comma-separated origins, or `*` for permissive dev |
| `GRACE_PERIOD_MS` | `60000` | Host-disconnect grace before room ends |
| `IDLE_TIMEOUT_MS` | `1800000` | 30 min of no messages → room ends |
| `MAX_SOCKETS_PER_ROOM` | `16` | |
| `MAX_BUFFER_BYTES` | `4194304` | 4 MB per docKind buffer |
| `ROOM_CREATE_PER_HOUR` | `5` | Per-IP rate limit on `POST /rooms` |

For local dev with a Next app on `localhost:3000`:

```sh
ALLOWED_ORIGINS=http://localhost:3000 npm run dev
```

## HTTP API

### `POST /rooms`

Mints a new room. No body. Rate-limited per IP.

**201 Created**
```json
{
  "roomUuid": "…",
  "hostToken": "…",
  "inviteTokens": { "edit": "…", "review": "…", "view": "…" }
}
```

The `hostToken` is the most sensitive value — anyone with it can claim the host role. Treat it like a session credential; never share. Invite tokens grant their respective role to anyone who has them.

### `GET /healthz`

Returns `{ "ok": true, "rooms": <n> }`.

## WebSocket

```
wss://collab.example.com/room/<roomUuid>?t=<token>
```

Origin header is validated against `ALLOWED_ORIGINS`. Token in the query string maps to a role. The encryption key is **not** included here — it lives only in the share-link fragment (`#k=…`) and never reaches the server.

The protocol envelope is JSON; payloads are base64 ciphertext. See `src/protocol.ts` for message schemas.

## Tests

```sh
npm test          # run once
npm run test:watch
npm run typecheck
```

## Deploy

The included `Dockerfile` produces a small runtime image. Tested deploy targets:

- **Fly.io** — `flyctl launch` from this directory; set secrets with `flyctl secrets set ALLOWED_ORIGINS=https://writr.app`.
- **Render** — point a Web Service at this directory; build `npm ci && npm run build`; start `npm start`.
- **Railway** — same as Render.

Behind a proxy, `X-Forwarded-For` is honored for rate-limit attribution.

## Security model

- Origin allowlist enforced on HTTP and WebSocket handshakes.
- Constant-time token comparison.
- Max payload size enforced at the WebSocket layer (256 KB).
- Per-IP rate limit on room creation.
- Role-based message gating (`canSend()` in `src/protocol.ts`).
- Logs are structured JSON without payloads, document contents, or display names.
- IPs appear only in the in-memory rate-limit counter and are not persisted.

The relay is **trusted to route honestly**, not to keep secrets — even a fully compromised relay should not be able to read content. Defense-in-depth is on the client (decrypted Yjs updates are validated against the ProseMirror schema before being applied).
