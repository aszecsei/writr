# Context

Domain glossary for the Writr codebase. Add a term here only when a deepened module is named after it (or a concept needs sharpening). Keep entries terse — the goal is a shared vocabulary, not an encyclopedia.

## Terms

### AgentRun
One execution of an agent (or chain of agents) against a project. Persisted as a Dexie row in `db.agentRuns` (schema: `AgentRunSchema` in `src/db/schemas.ts`). An AgentRun moves through phases (`reading`, `planning`, `executing-tier`, `applying-tier`, `verifying-tier`, …) tracked by its `status` field, and accumulates artifacts: notes, questions, work units, plans, proposed edits, verifications, reader bible entries.

### agent invocation
One call into an agent, scoped to an existing AgentRun. An invocation:

- applies the user-configured definition override to the agent
- resolves the agent's model from current `AppSettings`
- throws on missing API key (status=error is written by `runEngine.withRunErrorCapture`, not by the invocation itself)
- stamps every callback with `{ runId, origin: { agentKind, agentId } }` and forwards as a `PipelineEvent`
- tracks token usage via `withTokenAccounting`

Implemented by `invokeAgentForRun` in `src/lib/ai/agents/runner.ts`. The lower-level `runAgent` in the same file does not know about runs and is only called directly by free-form chat (`AiPanel`).
