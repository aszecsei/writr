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

- `registry.ts` — the consolidated `list` / `get` read tools spanning all bible categories, plus per-agent category scoping.
- `chapters.ts` — chapter CRUD and content reads (`read_chapter`, `read_chapter_range`, `search_chapter`, `get_chapter_structure`, `search_chapters`).
- `characters.ts` — character CRUD.
- `locations.ts` — location CRUD.
- `timeline.ts` — timeline event CRUD.
- `worldbuilding.ts` — worldbuilding doc CRUD + move.
- `scenes.ts` — scene metadata read/write.
- `outline.ts` — outline grid column/row/cell management.
- `proposedEdits.ts` — `propose_edit`, staging a developmental edit for the user to apply.
- `comments.ts` — `add_comment` / `reply_to_comment` for Beta Reader (auto-execute, persona-attributed inline editor comments).
- `delegate.ts` — `delegate`, running a named sub-agent to completion.
- `presentChoice.ts` — `present_choice`, pausing to ask the user to pick an option.
- `search.ts` — project-wide full-text search.
- `edit-locator.ts` — shared anchor-locating logic for `propose_edit` / `add_comment`.
- `helpers.ts` — shared validation/formatting.

## Serialization (`serialize.ts`)

Serializes style guide entries, guardrail entries, and the outline grid to the XML blocks `prompts.ts` embeds in the system context.

## Conventions

- New AI features should add a tool in `tool-calling/tools/` rather than embedding logic in prompts. The tool registry is the seam.
- Use `streamAi()` so the UI can render incremental tokens; don't await full responses.
- When changing prompt structure, update both the snapshot in `prompts.test.ts` and any agent system prompts in `src/lib/ai/agents/builtins/`.
