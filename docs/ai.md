# AI integration

`src/lib/ai/` holds everything for talking to LLMs. The Next.js route `/api/ai` is a thin proxy; all message construction, tool dispatch, and streaming logic is on the client.

## Providers and adapters

`src/lib/ai/providers.ts` enumerates supported providers. Provider-specific request/response shaping lives in `src/lib/ai/adapters/`:

- `anthropic-adapter.ts` — Anthropic Messages API.
- `openai-adapter.ts` — OpenAI Chat/Responses.
- `google-adapter.ts` — Google Gemini.
- `helpers.ts` — shared adapter utilities: `extractTextContent`, `parseBase64ImageDataUrl`, `generateToolUseId` (every adapter mints its own tool-call ids through this, including Google), `REASONING_EFFORT_SCALE` (the reasoning-effort-to-coarser-scale map Anthropic's `output_config.effort` and OpenRouter's Claude-4.6 `verbosity` workaround both use), and `toAiUsage()` (builds the `AiUsage` object each adapter would otherwise assemble by hand in both `complete()` and `stream()`).
- `types.ts` — `CompletionParams` / `ProviderAdapter` shared types.
- `index.ts` — exports the three adapter factories plus `PROVIDER_ADAPTERS`, the live `Record<AiProvider, ProviderAdapter>` the route dispatches on. Pulls in the provider SDKs (Node-only) — never import it from `"use client"` code; only `/api/ai/route.ts` should.

Each adapter normalizes streaming into a single internal event format so the rest of the codebase doesn't branch on provider.

## Client (`client.ts`)

Single entry point for sending an AI request. Features:

- Streams events through an async generator (`streamAi()`).
- Handles tool-call rounds: model emits a tool call → client dispatches via the tool registry → result is fed back to the model → loop.
- Caches prompt context where the provider supports it.
- `describeImage` and `summarizeChapter` are one-shot, non-streaming helpers that bypass the agent runner entirely; both go through the shared `postChat(body, signal)`, which does the `/api/ai` POST and upstream-error extraction once.

## Prompts (`prompts.ts`)

Builds system prompts that include the relevant slice of the story bible: characters, locations, style guide entries, and outline-grid context for the active scene. Tested in `prompts.test.ts`.

## Tool calling (`src/lib/ai/tool-calling/`)

Tools are registered in a central registry (`tool-calling/tools.ts`) and dispatched from the AI client. Each tool validates its arguments with Zod and returns a structured payload the model can ingest.

A tool's `parameters` — the JSON Schema sent to the model — is derived from its Zod `inputSchema` rather than hand-written: `defineTool()` (in `tool-calling/types.ts`) calls `zodToToolParameters()` whenever a tool omits `parameters`, which runs `z.toJSONSchema()` and reduces the result to the `ToolParametersSchema` subset the API route and adapters expect (no `$schema`, `additionalProperties`, `minLength`, etc.). A tool built on `z.discriminatedUnion()` (the outline-grid tools) gets its branches flattened into one object schema — a property is required only when every branch requires it, and enum-valued discriminant fields union their literal values across branches. Put a field's description on `.describe()` in the Zod schema, not in a separate `parameters` block.

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
