import type { AgentRunStatus } from "@/db/schemas";

/**
 * Human-readable labels for the active phases of a run. Used by the
 * dashboard's Retry button and the stranded-run banner so both surfaces
 * describe the failed/in-flight phase the same way.
 *
 * Terminal statuses (`complete`, `cancelled`, `error`, `idle`,
 * `awaiting-*`) intentionally omitted — they aren't phases the user can
 * resume or retry into.
 */
export const PHASE_STATUS_LABEL: Partial<Record<AgentRunStatus, string>> = {
  reading: "Reader pass",
  planning: "Orchestrator (planning)",
  "executing-tier": "Editor agents (executing tier)",
  "applying-tier": "Applying tier to manuscript",
  "verifying-tier": "Verifier",
};

/** Phases that are safe to re-enter via a Retry button. Apply/verify aren't
 *  safely resumable — partial work would be re-applied or re-verified. */
export const RETRYABLE_PHASE_STATUSES: AgentRunStatus[] = [
  "reading",
  "planning",
  "executing-tier",
];

export function isRetryablePhase(status: AgentRunStatus | null): boolean {
  return status !== null && RETRYABLE_PHASE_STATUSES.includes(status);
}
