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
    switch (event.type) {
      case "agent-iteration-start":
        store().beginIteration(
          event.runId,
          event.info,
          event.origin.agentKind,
          event.origin.agentId,
        );
        return;
      case "agent-chunk":
        store().appendChunk(event.runId, event.messageId, event.chunk);
        return;
      case "agent-iteration-end":
        store().completeIteration(event.runId, event.info);
        return;
      case "agent-tool-calls":
        store().setToolCalls(
          event.runId,
          event.info.messageId,
          event.info.entries,
        );
        return;
      case "agent-tool-update":
        store().updateToolCall(
          event.runId,
          event.info.messageId,
          event.info.entry,
        );
        return;
      // reader-pass-*, budget-exceeded, run-complete, run-error are surfaced
      // elsewhere (run dashboard banners) — the activity log doesn't need them.
      default:
        return;
    }
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
