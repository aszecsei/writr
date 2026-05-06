/**
 * Public surface of the pipeline phase engine. External callers (UI
 * components under `src/components/agents/`) should import from this facade
 * rather than reaching into individual modules — the internal layout is
 * implementation detail and may shift without warning.
 *
 * Internal cross-module imports inside this directory continue to use
 * specific module paths so this facade isn't a circular hub.
 */

// ─── Phase entry points & run control ──────────────────────────────

export {
  cancelRun,
  getRunController,
  type StartApplyTierOptions,
  type StartApplyTierResult,
  type StartExecuteTierOptions,
  type StartIncrementalRereadOptions,
  type StartPlanTierOptions,
  type StartReaderPhaseOptions,
  type StartRevertTierOptions,
  startApplyTier,
  startExecuteTier,
  startIncrementalReread,
  startPlanTier,
  startReaderPhase,
  startRevertTier,
} from "./runEngine";

// ─── Tier apply / revert results ───────────────────────────────────

export type { ApplyTierOptions, ApplyTierResult } from "./applyTier";
export type { RevertTierOptions, RevertTierResult } from "./revertTier";
export type { VerifyTierOptions, VerifyTierResult } from "./verifyTier";

// ─── Reader loop signals ───────────────────────────────────────────

export { BUDGET_EXCEEDED_REASON } from "./readerLoop";

// ─── Events / activity ─────────────────────────────────────────────

export { composeEmitters, createActivityEmitter } from "./activityEmitter";
export type {
  AgentEventOrigin,
  PipelineEvent,
  PipelineEventEmitter,
} from "./events";

// ─── Staged-content helpers (used by EditDiffCard) ─────────────────

export { applyEditsToContent } from "./stagedChapterContent";
