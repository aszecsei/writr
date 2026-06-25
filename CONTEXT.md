# Context

Domain glossary for the Writr codebase. Add a term here only when a deepened module is named after it (or a concept needs sharpening). Keep entries terse — the goal is a shared vocabulary, not an encyclopedia.

## Terms

### AgenticWriter
A declarative template that emits the two AI tool definitions (`create_<entity>`, `update_<entity>`) for one mutable project entity. Takes the entity's create/update Zod schemas, the underlying DB ops (`createX`, `getX`, `updateX`), a display-field accessor for `ok`/`fail` messages, and a per-entity description for the LLM. Derives the JSON-Schema `parameters` block from the Zod schema via `z.toJSONSchema()` — no double declaration. Enforces the [auto-approval invariant](#auto-approval-policy) by always setting `requiresApproval: true`.

The LLM-facing surface is unchanged: agents still see named tools (`create_character`, `update_location`, …) with entity-specific parameter shapes. Consolidation is internal — declare one AgenticWriter per mutable entity instead of two tool definitions.

Lives in `src/lib/ai/tool-calling/agentic-writer.ts`. Used by `tools/characters.ts`, `tools/locations.ts`, `tools/timeline.ts`, `tools/chapters.ts`, and (planned) `tools/worldbuilding.ts`, `tools/style-guide.ts`, `tools/outline.ts`.

### Auto-approval policy
Only read-only / non-mutating tools may set `requiresApproval: false`. Every mutation tool requires user approval before execution. Enforced by [[AgenticWriter]] (the constant `requiresApproval: true` is not configurable). See ADR-0001.

### delegation
A coordinating chat agent (the `orchestrator-chat` Orchestrator) hands a self-contained subtask to another agent via the `delegate` tool. The sub-agent runs its own `runAgent` tool loop with a fresh context and returns ONLY its final answer to the caller; its intermediate work never enters the caller's history. Depth is capped (`DELEGATE_MAX_DEPTH`) with a cycle guard over the delegation chain. The panel injects a `DelegationHost` on `ToolExecutionContext.delegation`; it is absent outside interactive chat, where `delegate` / `present_choice` fail gracefully. Implemented across `tools/delegate.ts`, `tools/presentChoice.ts`, and the AiPanel accessor; sub-agent transcripts render via `DelegatedAgentCard` and user gates via `PendingGatesBar`.
