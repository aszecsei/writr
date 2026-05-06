# AI integration

`src/lib/ai/` holds everything for talking to LLMs. The Next.js route `/api/ai` is a thin proxy; all message construction, tool dispatch, and streaming logic is on the client.

## Providers and adapters

`src/lib/ai/providers.ts` enumerates supported providers. Provider-specific request/response shaping lives in `src/lib/ai/adapters/`:

- `anthropic-adapter.ts` — Anthropic Messages API.
- `openai-adapter.ts` — OpenAI Chat/Responses.
- `google-adapter.ts` — Google Gemini.
- `helpers.ts`, `types.ts`, `index.ts` — shared adapter utilities.

Each adapter normalizes streaming into a single internal event format so the rest of the codebase doesn't branch on provider.

## Client (`client.ts`)

Single entry point for sending an AI request. Features:

- Streams events through an async generator (`streamAi()`).
- Handles tool-call rounds: model emits a tool call → client dispatches via the tool registry → result is fed back to the model → loop.
- Caches prompt context where the provider supports it.

## Prompts (`prompts.ts`)

Builds system prompts that include the relevant slice of the story bible: characters, locations, style guide entries, and outline-grid context for the active scene. Tested in `prompts.test.ts`.

## Tool calling (`src/lib/ai/tool-calling/`)

Tools are registered in a central registry (`tool-calling/tools.ts`) and dispatched from the AI client. Each tool validates its arguments with Zod and returns a structured payload the model can ingest.

Tools (`tool-calling/tools/`):

- `chapters.ts` — read/list/update chapter metadata.
- `characters.ts` — character CRUD.
- `locations.ts` — location CRUD.
- `timeline.ts` — timeline event CRUD.
- `bible.ts` — combined bible queries.
- `notes.ts` — agent notes (work-unit annotations).
- `workUnits.ts` — work-unit assignment & status updates.
- `proposedEdits.ts` — propose, list, and resolve edits to chapter prose.
- `verification.ts` — record verification findings.
- `search.ts` — project-wide full-text search.
- `helpers.ts` — shared validation/formatting.
- `registry.ts` — central dispatch + schema export.

## Serialization (`serialize.ts`)

Round-trips tool call payloads / messages between the persisted `AgentRun` shape and what the provider expects.

## Conventions

- New AI features should add a tool in `tool-calling/tools/` rather than embedding logic in prompts. The tool registry is the seam.
- Use `streamAi()` so the UI can render incremental tokens; don't await full responses.
- When changing prompt structure, update both the snapshot in `prompts.test.ts` and any agent system prompts in `src/lib/ai/agents/builtins/`.
