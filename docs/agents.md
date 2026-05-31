# Agents

Agents are configurable AI personas that operate over a project: drafting prose, reviewing chapters, maintaining a "reader bible," and proposing edits. The agent system spans the database (`AgentDefinition`, `AgentRun`, …), the AI library (`src/lib/ai/agents/`), and dedicated UI (`src/components/agents/`, `/projects/[projectId]/agents`).

## Data model

See `docs/database.md` for full schema. Key entities:

- **`AgentDefinition`** — A reusable agent: name, kind, model override, tool permissions, system prompt fragments. Managed via `AgentsManager` / `AgentEditor` (settings UI).
- **`AgentRun`** — One execution of an agent against a project. Tracks status, iterations, token usage, plan, and links to all artifacts produced.
- **`AgentRunUsage`** — Token / cost accounting.
- **`AgentNote`**, **`AgentQuestion`** — Free-form annotations and clarifying questions raised during a run.
- **`WorkUnit`** + **`WorkUnitPlacement`** — Discrete tasks the agent breaks the project into.
- **`EditPlan`** + **`EditPlanTier`** — Tiered edit strategy (e.g., line edits vs. structural).
- **`ProposedEdit`** — A specific edit suggestion against a chapter; user-approvable.
- **`Verification`** + **`VerificationFinding`** — Cross-chapter consistency checks.
- **`ReaderPass`**, **`ReaderBibleLogEntry`**, **`ReaderBibleViewEntry`** — Reader-mode aggregation: builds a "what an attentive reader would know" view of the manuscript.
- **`ChapterSummary`**, **`SnapshotManifest`** — Per-chapter summaries and snapshot bookkeeping.

## Library (`src/lib/ai/agents/`)

```
runner.ts                Top-level run executor; orchestrates iterations
build-messages.ts        Composes provider messages from run state + history
applyDefinitionOverride  Per-run overrides on top of an AgentDefinition
tool-filter.ts           Restricts the tool registry to the agent's permissions
types.ts                 Shared agent types

builtins/                Prebuilt agent templates
  chatAgent.ts           Free-form chat
  editor.ts              Line/structural editor
  reader.ts              Reader-bible builder
  verifier.ts            Cross-chapter consistency
  voice.ts               Voice / style coach
  screenplay.ts          Screenplay-mode coach
  orchestrator.ts        Coordinator that delegates to other agents
  betaReader.ts          Beta Reader panel: Maya / Anton / Joan personas + XML prompt
  defaults.ts            Default agent definitions
  tool-permissions.ts    Per-agent tool permission maps

pipeline/                Multi-stage execution machinery
  runEngine.ts           Single-run execution loop
  tierRunner.ts          Per-tier edit pipeline
  applyTier.ts           Applies an EditPlanTier's accepted edits
  revertTier.ts          Rolls back an applied tier
  verifyTier.ts          Verification pass over an applied tier
  readerLoop.ts          Reader-bible accumulation loop
  driftDetect.ts         Detects content drift between snapshots
  stagedChapterContent   Chapter staging (apply/revert sandbox)
  tokenAccounting.ts     Per-run token + cost tracking
  events.ts              Pipeline event types
  activityEmitter.ts     Surfaces events to agentActivityStore
```

## UI

- **`/projects/[projectId]/agents`** — Run dashboard: pick an agent, configure budget, watch the live activity feed, accept/reject proposed edits.
- **`src/components/agents/`** — Run dashboard, plan view, work-unit cards, edit approval panels, verification panel, snapshots panel, reader-bible view, pause/resume banner, raise-budget dialog.
- **`src/components/settings/AgentEditor.tsx`** + **`AgentsManager.tsx`** — Manage `AgentDefinition` rows.
- **`agentActivityStore`** (`src/store/agentActivityStore.ts`) — Live streaming UI state per active run.

## Beta Reader panel

A single-pass chat agent (`kind: "beta-reader"`, `behavior: "panel"`) that role-plays three reader personas — **Maya** (emotional reactions), **Anton** (craft observation), **Joan** (skeptical pushback). The system prompt is XML-structured: each `<persona id="X">` block reads as a self-contained agent brief, and the model emits its response in `<maya>`, `<anton>`, `<joan>` blocks parsed by `BetaReaderPanelMessage` into labeled sections.

Two auto-execute tools back the panel:

- **`add_comment`** — drops a selection comment using the same `prefix + anchorText + suffix` snippet methodology and uniqueness contract as `propose_edit`. The model passes `persona`; the tool stamps `author` / `authorColor` / `color` from `BETA_READER_PERSONA_ATTRIBUTION` (single source of truth in `builtins/betaReader.ts`).
- **`reply_to_comment`** — adds a reply to an existing root comment; inherits position from the parent. Replies-of-replies are rejected to keep threads flat.

Forward-compat seam: `extractPersonaPrompts(BETA_READER_PANEL_PROMPT)` parses the three persona blocks out of the panel prompt, so a future per-persona conversion can seed three standalone agents without rewriting the briefs.

## Conventions

- Don't bypass the pipeline. Even a one-shot AI call should go through `runner.ts` if it's an agent; `client.ts` is for free-form chat.
- New agent kinds: add a builtin in `builtins/`, an entry in `defaults.ts`, and (if it needs new tools) extend `tool-permissions.ts`.
- When adding a new pipeline stage, emit events through `activityEmitter.ts` so the activity panel reflects progress.
- Agent runs can be long-lived — every persistent state change must be a Dexie write, not just store state, so the run survives a refresh.
