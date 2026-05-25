# Context

Domain glossary for the Writr codebase. Add a term here only when a deepened module is named after it (or a concept needs sharpening). Keep entries terse — the goal is a shared vocabulary, not an encyclopedia.

## Terms

### AgentRun
One execution of an agent (or chain of agents) against a project. Persisted as a Dexie row in `db.agentRuns` (schema: `AgentRunSchema` in `src/db/schemas.ts`). An AgentRun moves through phases (`reading`, `planning`, `executing-tier`, `applying-tier`, `verifying-tier`, …) tracked by its `status` field, and accumulates artifacts: notes, questions, work units, plans, proposed edits, verifications, reader bible entries.

### AgenticWriter
A declarative template that emits the two AI tool definitions (`create_<entity>`, `update_<entity>`) for one mutable project entity. Takes the entity's create/update Zod schemas, the underlying DB ops (`createX`, `getX`, `updateX`), a display-field accessor for `ok`/`fail` messages, and a per-entity description for the LLM. Derives the JSON-Schema `parameters` block from the Zod schema via `z.toJSONSchema()` — no double declaration. Enforces the [auto-approval invariant](#auto-approval-policy) by always setting `requiresApproval: true`.

The LLM-facing surface is unchanged: agents still see named tools (`create_character`, `update_location`, …) with entity-specific parameter shapes. Consolidation is internal — declare one AgenticWriter per mutable entity instead of two tool definitions.

Lives in `src/lib/ai/tool-calling/agentic-writer.ts`. Used by `tools/characters.ts`, `tools/locations.ts`, `tools/timeline.ts`, `tools/chapters.ts`, and (planned) `tools/worldbuilding.ts`, `tools/style-guide.ts`, `tools/outline.ts`.

### Auto-approval policy
Only read-only / non-mutating tools may set `requiresApproval: false`. Every mutation tool requires user approval before execution. Enforced by [[AgenticWriter]] (the constant `requiresApproval: true` is not configurable). See ADR-0001.

### agent invocation
One call into an agent, scoped to an existing AgentRun. An invocation:

- applies the user-configured definition override to the agent
- resolves the agent's model from current `AppSettings`
- throws on missing API key (status=error is written by `runEngine.withRunErrorCapture`, not by the invocation itself)
- stamps every callback with `{ runId, origin: { agentKind, agentId } }` and forwards as a `PipelineEvent`
- tracks token usage via `withTokenAccounting`

Implemented by `invokeAgentForRun` in `src/lib/ai/agents/runner.ts`. The lower-level `runAgent` in the same file does not know about runs and is only called directly by free-form chat (`AiPanel`).
