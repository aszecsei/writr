import { db } from "../database";
import {
  type AgentKind,
  type AgentModelOverride,
  type AgentRun,
  AgentRunSchema,
  type AgentRunStatus,
  type AgentRunUsage,
  type ReaderPass,
} from "../schemas";
import { generateId, now } from "./helpers";

const TERMINAL_STATUSES: AgentRunStatus[] = ["complete", "cancelled", "error"];

export function isTerminalStatus(status: AgentRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface CreateAgentRunInput {
  projectId: string;
  name: string;
  modelOverrides: Record<AgentKind, AgentModelOverride | null>;
  budgetTokens?: number;
}

/**
 * Create a new agent run. Throws if the project already has a non-terminal
 * run — only one run per project may be in flight at a time (Phase 1 rule).
 */
export async function createAgentRun(
  input: CreateAgentRunInput,
): Promise<AgentRun> {
  const active = await getActiveAgentRun(input.projectId);
  if (active) {
    throw new Error(
      `Project already has an in-flight run (${active.id}). Cancel it before starting a new one.`,
    );
  }
  const timestamp = now();
  const run = AgentRunSchema.parse({
    id: generateId(),
    projectId: input.projectId,
    name: input.name,
    status: "idle",
    currentTier: 0,
    currentSnapshotManifestId: null,
    readerPasses: [],
    modelOverrides: input.modelOverrides,
    budgetTokens: input.budgetTokens ?? 1_000_000,
    totalTokenUsage: { promptTokens: 0, completionTokens: 0 },
    requiresIncrementalReread: false,
    statusReason: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.agentRuns.add(run);
  return run;
}

export async function getAgentRun(id: string): Promise<AgentRun | undefined> {
  return db.agentRuns.get(id);
}

export async function listAgentRunsByProject(
  projectId: string,
): Promise<AgentRun[]> {
  return db.agentRuns.where({ projectId }).reverse().sortBy("createdAt");
}

/** Returns the project's currently in-flight (non-terminal) run, if any. */
export async function getActiveAgentRun(
  projectId: string,
): Promise<AgentRun | undefined> {
  const runs = await db.agentRuns.where({ projectId }).toArray();
  return runs.find((r) => !isTerminalStatus(r.status));
}

export async function updateAgentRunStatus(
  id: string,
  status: AgentRunStatus,
  reason?: string | null,
): Promise<void> {
  await db.agentRuns.update(id, {
    status,
    statusReason: reason ?? null,
    updatedAt: now(),
  });
}

export async function updateAgentRun(
  id: string,
  data: Partial<
    Pick<
      AgentRun,
      | "currentTier"
      | "currentSnapshotManifestId"
      | "requiresIncrementalReread"
      | "totalTokenUsage"
      | "name"
    >
  >,
): Promise<void> {
  await db.agentRuns.update(id, { ...data, updatedAt: now() });
}

/** Append a reader pass record. Mutates `readerPasses` array atomically. */
export async function appendReaderPass(
  runId: string,
  pass: ReaderPass,
): Promise<void> {
  await db.transaction("rw", db.agentRuns, async () => {
    const run = await db.agentRuns.get(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);
    await db.agentRuns.update(runId, {
      readerPasses: [...run.readerPasses, pass],
      updatedAt: now(),
    });
  });
}

/** Mark the most recent reader pass as completed and update its delta counts. */
export async function finishReaderPass(
  runId: string,
  patch: Partial<
    Pick<ReaderPass, "newBibleEntries" | "newNotes" | "newQuestions">
  >,
): Promise<void> {
  await db.transaction("rw", db.agentRuns, async () => {
    const run = await db.agentRuns.get(runId);
    if (!run || run.readerPasses.length === 0) return;
    const passes = [...run.readerPasses];
    const last = passes[passes.length - 1];
    passes[passes.length - 1] = {
      ...last,
      ...patch,
      completedAt: now(),
    };
    await db.agentRuns.update(runId, {
      readerPasses: passes,
      updatedAt: now(),
    });
  });
}

/**
 * Add to the run's cumulative token usage. Returns the new totals so callers
 * can detect budget overruns without re-fetching the row.
 */
export async function addTokenUsage(
  runId: string,
  delta: Partial<AgentRunUsage>,
): Promise<AgentRunUsage> {
  let next: AgentRunUsage = { promptTokens: 0, completionTokens: 0 };
  await db.transaction("rw", db.agentRuns, async () => {
    const run = await db.agentRuns.get(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);
    next = {
      promptTokens:
        run.totalTokenUsage.promptTokens + (delta.promptTokens ?? 0),
      completionTokens:
        run.totalTokenUsage.completionTokens + (delta.completionTokens ?? 0),
    };
    await db.agentRuns.update(runId, {
      totalTokenUsage: next,
      updatedAt: now(),
    });
  });
  return next;
}

export async function deleteAgentRun(id: string): Promise<void> {
  await db.agentRuns.delete(id);
}
