import { match, P } from "ts-pattern";
import { useAgentActivityStore } from "@/store/agentActivityStore";
import type { PipelineEvent, PipelineEventEmitter } from "./events";

/**
 * Bridge `PipelineEvent`s emitted by the run engine to the in-memory activity
 * store so the dashboard's Activity tab can render LLM thoughts and tool calls
 * as they happen.
 *
 * The emitter is stateless — every event carries its own runId and origin
 * (agentKind + agentId) — so a single instance can be reused across an entire
 * pipeline phase regardless of which agent kinds run inside it.
 */
export function createActivityEmitter(): PipelineEventEmitter {
  const store = useAgentActivityStore.getState;
  return (event: PipelineEvent) => {
    match(event)
      .with({ type: "agent-iteration-start" }, (e) =>
        store().beginIteration(
          e.runId,
          e.info,
          e.origin.agentKind,
          e.origin.agentId,
        ),
      )
      .with({ type: "agent-chunk" }, (e) =>
        store().appendChunk(e.runId, e.messageId, e.chunk),
      )
      .with({ type: "agent-iteration-end" }, (e) =>
        store().completeIteration(e.runId, e.info),
      )
      .with({ type: "agent-tool-calls" }, (e) =>
        store().setToolCalls(e.runId, e.info.messageId, e.info.entries),
      )
      .with({ type: "agent-tool-update" }, (e) =>
        store().updateToolCall(e.runId, e.info.messageId, e.info.entry),
      )
      // reader-pass-*, reader-chapter-*, budget-exceeded, run-complete,
      // run-error are surfaced elsewhere (run dashboard banners) — the
      // activity log doesn't need them. Listed explicitly so a new
      // PipelineEvent variant fails the .exhaustive() check.
      .with(
        {
          type: P.union(
            "reader-pass-start",
            "reader-pass-complete",
            "reader-chapter-start",
            "reader-chapter-complete",
            "budget-exceeded",
            "run-complete",
            "run-error",
          ),
        },
        () => undefined,
      )
      .exhaustive();
  };
}

/**
 * Compose multiple emitters into one — useful when a call site wants both the
 * activity store updates AND custom local handling (e.g. a toast on
 * `run-error`).
 */
export function composeEmitters(
  ...emitters: (PipelineEventEmitter | undefined)[]
): PipelineEventEmitter {
  const filtered = emitters.filter(
    (e): e is PipelineEventEmitter => e !== undefined,
  );
  return (event) => {
    for (const e of filtered) e(event);
  };
}
