# Agents

Agents are configurable AI personas that operate over a project: drafting prose, reviewing chapters, brainstorming, building the outline, and proposing edits. The agent system spans the database (`AgentDefinition`), the AI library (`src/lib/ai/agents/`), and dedicated UI (`src/components/agents/`, `/projects/[projectId]/agents/definitions`).

Agents run inside the AiPanel chat. There is no separate batch "run" pipeline — a coordinating agent fans work out to other agents via **sub-agent delegation** (see below).

## Data model

See `docs/database.md` for full schema. Key entity:

- **`AgentDefinition`** — A reusable agent: name, kind, model override, tool permissions, system prompt. Managed from the **Agents sidebar panel** (`AgentsNav`, split into Global / Project) and edited on the `/projects/[projectId]/agents/definitions/[agentId]` route via `AgentEditorBody`. Built-in agents are global singletons-per-kind; `kind="user"` agents may be project-scoped.

`ChapterSummary` (cached per-chapter summaries) lives nearby in the schema but is independent of agents — it backs the `get:summary` read tool and the chapter-properties summarizer.

## Library (`src/lib/ai/agents/`)

```
runner.ts                Headless agent runner: streaming → tool-call loop (runAgent)
                         + resolveAgentModel (per-agent override → AppSettings)
build-messages.ts        Composes provider messages from system + context + history
accessor.ts              ChatHistoryAccessor interface the runner reads/writes through
tool-filter.ts           Restricts the tool registry to the agent's permissions
types.ts                 Shared agent types (Agent, RunAgentOptions, …)

builtins/
  chatAgent.ts           Synthesizes a runnable Agent from an AgentDefinition row
  reader.ts              READER_CHAT_PROMPT (review / summarize / consistency-check)
  editor.ts              EDITOR_CHAT_PROMPT (line edits; stages via propose_edit)
  betaReader.ts          Beta Reader panel: Maya / Anton / Joan personas + XML prompt
  outlineArchitect.ts    Outline-grid builder
  worldbuilder.ts        World-bible builder
  voice.ts / screenplay.ts  Shared prompt suffixes
  defaults.ts            BUILTIN_AGENT_DEFAULTS — bundled chat-agent definitions
  tool-permissions.ts    Per-agent tool permission lists
```

## Built-in chat agents

`spark`, `scene`, `reader`, `editor`, `character-dialogue`, `brainstorm`, `chat`, `beta-reader`, `outline-architect`, `worldbuilder`, and `orchestrator-chat`. Each has a `behavior` (`spark` / `scene` / `review` / `edit` / `chat` / `panel`) that drives how the AiPanel renders its response. `kind="user"` agents are user-created and always behave as `chat`.

## Sub-agent delegation

The **Orchestrator** (`orchestrator-chat`) keeps its own context lean by handing self-contained subtasks to other agents. Two tools back it:

- **`delegate`** (`tools/delegate.ts`) — runs a named sub-agent to completion and returns ONLY its final answer. The sub-agent runs its own tool loop with a fresh context; its intermediate work never enters the caller's history. Nesting is capped at `DELEGATE_MAX_DEPTH`, with a cycle guard over the delegation chain.
- **`present_choice`** (`tools/presentChoice.ts`) — pauses to ask the user to pick one of several options.

Both reach the panel through the `DelegationHost` injected on `ToolExecutionContext.delegation` (set by the AiPanel accessor; absent — and the tools fail gracefully — outside interactive chat). Delegation runs entirely through `runAgent` + the chat accessor; sub-agent transcripts render nested under the delegate call via `DelegatedAgentCard`, and user-facing gates surface in `PendingGatesBar`.

## Beta Reader panel

A single-pass chat agent (`kind: "beta-reader"`, `behavior: "panel"`) that role-plays three reader personas — **Maya** (emotional reactions), **Anton** (craft observation), **Joan** (skeptical pushback). The system prompt is XML-structured: each `<persona id="X">` block reads as a self-contained brief, and the model emits its response in `<maya>`, `<anton>`, `<joan>` blocks parsed by `BetaReaderPanelMessage` into labeled sections.

Two auto-execute tools back the panel:

- **`add_comment`** — drops a selection comment using the same `prefix + anchorText + suffix` snippet methodology and uniqueness contract as `propose_edit`. The model passes `persona`; the tool stamps `author` / `authorColor` / `color` from `BETA_READER_PERSONA_ATTRIBUTION` (single source of truth in `builtins/betaReader.ts`).
- **`reply_to_comment`** — adds a reply to an existing root comment; inherits position from the parent. Replies-of-replies are rejected to keep threads flat.

## Conventions

- New agent kinds: add a builtin prompt in `builtins/`, an entry in `defaults.ts` + the `AgentKind` enum in `schemas.ts`, and (if it needs new tools) extend `tool-permissions.ts` and the tool registry.
- Adding an AI tool also means wiring `agent-tool-picker.ts`, `AI_TOOLS` (`tool-calling/tools.ts`), the per-agent permission lists, and the `tools.test.ts` count.
