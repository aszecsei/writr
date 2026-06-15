import type { EmbeddingProvider } from "./provider";
import { WorkerEmbeddingProvider } from "./worker-provider";

let instance: EmbeddingProvider | null = null;

/** Lazy browser singleton. The model loads on first embed() call, not here. */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (typeof window === "undefined") {
    throw new Error("getEmbeddingProvider must be called in the browser");
  }
  if (!instance) instance = new WorkerEmbeddingProvider();
  return instance;
}
