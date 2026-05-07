import { listAgentNotes } from "@/db/operations/agentNotes";
import { listAgentQuestions } from "@/db/operations/agentQuestions";
import { updateAgentRunStatus } from "@/db/operations/agentRuns";
import { getChapter } from "@/db/operations/chapters";
import { getEditPlanByRun, upsertEditPlan } from "@/db/operations/editPlans";
import { listBiblePaths, readBibleAtPath } from "@/db/operations/readerBible";
import { listWorkUnitsByTier, updateWorkUnit } from "@/db/operations/workUnits";
import type {
  AgentRunId,
  ChapterId,
  ProjectId,
  ReaderBibleViewEntry,
  WorkUnit,
  WorkUnitId,
} from "@/db/schemas";
import type { AiContext } from "../../types";
import { makeEditorAgent } from "../builtins/editor";
import { makeOrchestratorAgent } from "../builtins/orchestrator";
import { invokeAgentForRun } from "../runner";
import type { PipelineEventEmitter } from "./events";

export interface PlanTierOptions {
  runId: AgentRunId;
  projectId: ProjectId;
  tier: number;
  humanBriefing?: string;
  signal?: AbortSignal;
  onEvent?: PipelineEventEmitter;
  buildContext: () => Promise<AiContext>;
}

/**
 * Run the orchestrator for one tier. Produces work-unit rows and finalizes
 * the tier on the edit plan. Transitions the run to `awaiting-plan-approval`
 * when complete, where the user reviews the plan before tier execution.
 */
export async function planTier(options: PlanTierOptions): Promise<void> {
  const {
    runId,
    projectId,
    tier,
    humanBriefing,
    signal,
    onEvent,
    buildContext,
  } = options;

  await updateAgentRunStatus(runId, "planning");

  const [openNotes, openQuestions, context] = await Promise.all([
    listAgentNotes({ runId, status: "open" }),
    listAgentQuestions({ runId, status: "open" }),
    buildContext(),
  ]);

  const agent = makeOrchestratorAgent({
    runId,
    projectId,
    tier,
    openNotes,
    openQuestions,
    humanBriefing,
    context,
  });

  // Ensure a plan row exists so the orchestrator's finalize_tier can attach.
  await upsertEditPlan({ projectId, runId });

  await invokeAgentForRun({ runId, agent, signal, onEvent });

  if (signal?.aborted) {
    await updateAgentRunStatus(runId, "cancelled", "Cancelled during planning");
    return;
  }

  await updateAgentRunStatus(
    runId,
    "awaiting-plan-approval",
    `Plan for tier ${tier} ready for review`,
  );
}

export interface ExecuteTierOptions {
  runId: AgentRunId;
  projectId: ProjectId;
  tier: number;
  signal?: AbortSignal;
  onEvent?: PipelineEventEmitter;
  buildContext: () => Promise<AiContext>;
}

/**
 * Execute a tier's work units in dependency order. Editors propose edits to
 * a STAGING table — the manuscript isn't touched. Within a level (mutually
 * non-conflicting work units) we run editors in parallel up to a small cap.
 *
 * Single-chapter conflicts are pushed into dependencies (so they serialize
 * within the tier). Cross-chapter parallelism is the common path.
 */
export async function executeTier(options: ExecuteTierOptions): Promise<void> {
  const { runId, projectId, tier, signal, onEvent, buildContext } = options;

  await updateAgentRunStatus(runId, "executing-tier");

  const plan = await getEditPlanByRun(runId);
  if (!plan) throw new Error(`No edit plan for run ${runId}`);
  const planTier = plan.tiers.find((t) => t.tierNumber === tier);
  if (!planTier)
    throw new Error(`Tier ${tier} not finalized on edit plan for run ${runId}`);

  const allUnits = await listWorkUnitsByTier(runId, tier);
  // Only include the units listed by the plan (in case the orchestrator left
  // unattached drafts behind).
  const byId = new Map(allUnits.map((u) => [u.id, u]));
  const planUnits = planTier.workUnitIds
    .map((id) => byId.get(id))
    .filter((u): u is WorkUnit => !!u);

  // Skip units that already finished a prior execution (resume idempotency —
  // PauseResumeBanner re-invokes executeTier after a stranded run).
  const units = planUnits.filter(
    (u) =>
      u.status !== "awaiting-approval" &&
      u.status !== "approved" &&
      u.status !== "applied" &&
      u.status !== "rejected" &&
      u.status !== "superseded",
  );

  if (units.length === 0) {
    await updateAgentRunStatus(
      runId,
      "awaiting-edit-approval",
      planUnits.length === 0
        ? `Tier ${tier} had no work units to execute`
        : `Tier ${tier} already executed — ${planUnits.length} work unit${planUnits.length === 1 ? "" : "s"} ready for review`,
    );
    return;
  }

  // Topological levels: A→B if B depends on A, OR they share a chapter and A
  // is positioned earlier (so the second editor sees the first's staged work).
  const levels = computeLevels(units);

  const context = await buildContext();
  const concurrency = Math.max(
    1,
    Math.min(4, navigator?.hardwareConcurrency ?? 2),
  );

  for (const level of levels) {
    if (signal?.aborted) {
      await updateAgentRunStatus(
        runId,
        "cancelled",
        "Cancelled during tier execution",
      );
      return;
    }

    // Run this level's editors in parallel up to `concurrency`.
    let cursor = 0;
    const workers: Promise<void>[] = [];
    const launchNext = (): Promise<void> | null => {
      if (cursor >= level.length) return null;
      const unit = level[cursor++];
      return runOneEditor(unit, runId, projectId, context, signal, onEvent)
        .catch(async (err) => {
          await updateWorkUnit(unit.id, { status: "rejected" });
          onEvent?.({
            type: "run-error",
            runId,
            error: `Editor for "${unit.goal.slice(0, 50)}" failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          });
        })
        .then(() => {
          const next = launchNext();
          if (next) workers.push(next);
        });
    };
    for (let i = 0; i < concurrency; i++) {
      const w = launchNext();
      if (w) workers.push(w);
    }
    await Promise.all(workers);
  }

  if (signal?.aborted) {
    await updateAgentRunStatus(runId, "cancelled");
    return;
  }

  await updateAgentRunStatus(
    runId,
    "awaiting-edit-approval",
    `Tier ${tier} edits ready for review`,
  );
}

async function runOneEditor(
  unit: WorkUnit,
  runId: AgentRunId,
  projectId: ProjectId,
  context: AiContext,
  signal: AbortSignal | undefined,
  onEvent: PipelineEventEmitter | undefined,
): Promise<void> {
  await updateWorkUnit(unit.id, { status: "in-progress" });

  const chapter = await getChapter(unit.placement.chapterId);
  const bibleRefs = await loadBibleRefs(runId, unit.bibleRefs);

  const agent = makeEditorAgent({
    runId,
    projectId,
    workUnit: unit,
    bibleRefs,
    chapterTitle: chapter?.title ?? "(unknown)",
    context,
  });

  await invokeAgentForRun({ runId, agent, signal, onEvent });

  await updateWorkUnit(unit.id, { status: "awaiting-approval" });
}

async function loadBibleRefs(
  runId: AgentRunId,
  refs: string[],
): Promise<ReaderBibleViewEntry[]> {
  const out: ReaderBibleViewEntry[] = [];
  for (const ref of refs) {
    try {
      // Treat the ref as either an exact path or a path prefix — agents
      // sometimes pass "characters/Kira" expecting all sub-paths.
      const exact = await readBibleAtPath(runId, ref);
      if (exact) {
        out.push(exact);
        continue;
      }
      const prefixed = await listBiblePaths(runId, ref);
      out.push(...prefixed);
    } catch {
      // Invalid path — silently skip; the agent can still see what it has.
    }
  }
  return out;
}

/**
 * Build dependency-respecting execution levels. Within a level, units may
 * run concurrently (no chapter overlap, no explicit dependency).
 */
function computeLevels(units: WorkUnit[]): WorkUnit[][] {
  const idToUnit = new Map(units.map((u) => [u.id, u]));
  const inDegree = new Map<WorkUnitId, number>();
  const dependents = new Map<WorkUnitId, WorkUnitId[]>();

  for (const u of units) {
    inDegree.set(u.id, 0);
    dependents.set(u.id, []);
  }

  // Explicit dependencies.
  for (const u of units) {
    for (const dep of u.dependencies) {
      if (!idToUnit.has(dep)) continue;
      inDegree.set(u.id, (inDegree.get(u.id) ?? 0) + 1);
      dependents.get(dep)?.push(u.id);
    }
  }

  // Implicit chapter-overlap edges: if A and B share a chapter and A's
  // anchor offset (or paragraph index) is earlier, B depends on A.
  const byChapter = new Map<ChapterId, WorkUnit[]>();
  for (const u of units) {
    const list = byChapter.get(u.placement.chapterId) ?? [];
    list.push(u);
    byChapter.set(u.placement.chapterId, list);
  }
  for (const list of byChapter.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => positionRank(a) - positionRank(b));
    for (let i = 1; i < list.length; i++) {
      const earlier = list[i - 1];
      const later = list[i];
      // Skip if a dependency edge already exists in either direction.
      if (
        later.dependencies.includes(earlier.id) ||
        earlier.dependencies.includes(later.id)
      ) {
        continue;
      }
      inDegree.set(later.id, (inDegree.get(later.id) ?? 0) + 1);
      dependents.get(earlier.id)?.push(later.id);
    }
  }

  // Kahn's algorithm in levels.
  const levels: WorkUnit[][] = [];
  let frontier = units.filter((u) => (inDegree.get(u.id) ?? 0) === 0);
  while (frontier.length > 0) {
    levels.push(frontier);
    const next: WorkUnit[] = [];
    for (const u of frontier) {
      for (const child of dependents.get(u.id) ?? []) {
        const deg = (inDegree.get(child) ?? 0) - 1;
        inDegree.set(child, deg);
        if (deg === 0) {
          const childUnit = idToUnit.get(child);
          if (childUnit) next.push(childUnit);
        }
      }
    }
    frontier = next;
  }

  // If a cycle slipped through, dump remaining units in one final batch.
  const seen = new Set(levels.flat().map((u) => u.id));
  const orphaned = units.filter((u) => !seen.has(u.id));
  if (orphaned.length > 0) levels.push(orphaned);

  return levels;
}

function positionRank(u: WorkUnit): number {
  if (u.placement.paragraphIndex !== undefined)
    return u.placement.paragraphIndex;
  // Fall back to the order the orchestrator created units in. No anchor =
  // append-style; rank these last.
  if (u.placement.position === "before") return 0;
  if (
    u.placement.position === "replace" ||
    u.placement.position === "insert-at"
  )
    return 1_000_000;
  return Number.MAX_SAFE_INTEGER;
}
