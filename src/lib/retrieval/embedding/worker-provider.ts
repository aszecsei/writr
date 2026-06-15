import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_ID } from "./pipeline";
import type { EmbeddingProvider, EmbeddingsResponse } from "./provider";

interface Pending {
  resolve: (r: EmbeddingsResponse) => void;
}

/** EmbeddingProvider backed by a Web Worker running transformers.js. */
export class WorkerEmbeddingProvider implements EmbeddingProvider {
  readonly id = EMBEDDING_MODEL_ID;
  readonly dimensions = EMBEDDING_DIMENSIONS;
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, Pending>();

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { type: "result"; id: number; vectors: number[][] }
        | { type: "error"; id: number; message: string };
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.type === "result")
        p.resolve({ status: "success", output: msg.vectors, model: this.id });
      else p.resolve({ status: "error", message: msg.message });
    };
  }

  embed(
    texts: string[],
    options?: { signal?: AbortSignal },
  ): Promise<EmbeddingsResponse> {
    if (options?.signal?.aborted)
      return Promise.resolve({ status: "cancelled" });
    const id = ++this.seq;
    return new Promise<EmbeddingsResponse>((resolve) => {
      this.pending.set(id, { resolve });
      const onAbort = () => {
        if (this.pending.delete(id)) resolve({ status: "cancelled" });
      };
      options?.signal?.addEventListener("abort", onAbort, { once: true });
      this.worker.postMessage({ type: "embed", id, texts });
    });
  }
}
