import { hashText } from "../hash";
import type { EmbeddingProvider, EmbeddingsResponse } from "./provider";

/**
 * Deterministic, dependency-free EmbeddingProvider. Seeds an LCG from
 * hashText so identical text yields identical normalized vectors. For tests
 * and as an offline fallback — NOT semantically meaningful.
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly id = "fake-v1";
  readonly dimensions: number;

  constructor(dimensions = 384) {
    this.dimensions = dimensions;
  }

  async embed(
    texts: string[],
    options?: { signal?: AbortSignal },
  ): Promise<EmbeddingsResponse> {
    if (options?.signal?.aborted) return { status: "cancelled" };
    const output = texts.map((t) => this.vectorFor(t));
    return { status: "success", output, model: this.id };
  }

  private vectorFor(text: string): number[] {
    let seed = parseInt(hashText(text), 16) || 1;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const v = Array.from({ length: this.dimensions }, () => next() - 0.5);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  }
}
