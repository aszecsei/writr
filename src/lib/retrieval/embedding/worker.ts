import { embedTexts } from "./pipeline";

export interface EmbedRequest {
  type: "embed";
  id: number;
  texts: string[];
}
type Outbound =
  | { type: "result"; id: number; vectors: number[][] }
  | { type: "error"; id: number; message: string };

/**
 * This module only ever runs inside a dedicated worker, where `self` is a
 * `DedicatedWorkerGlobalScope` — but the project's tsconfig only pulls in
 * the "dom" lib (needed everywhere else), which types `self` as `Window`
 * and has no `DedicatedWorkerGlobalScope` to reference. Overriding `self`'s
 * type locally, to just the worker-scope surface this file uses, avoids
 * casting at every postMessage call without pulling in "webworker" (which
 * conflicts with "dom"'s globals) for the whole project.
 */
declare const self: {
  onmessage: ((event: MessageEvent<EmbedRequest>) => unknown) | null;
  postMessage(message: Outbound): void;
};

self.onmessage = async (e: MessageEvent<EmbedRequest>) => {
  const msg = e.data;
  if (msg.type !== "embed") return;
  try {
    const vectors = await embedTexts(msg.texts);
    self.postMessage({
      type: "result",
      id: msg.id,
      vectors,
    } satisfies Outbound);
  } catch (err) {
    self.postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    } satisfies Outbound);
  }
};
