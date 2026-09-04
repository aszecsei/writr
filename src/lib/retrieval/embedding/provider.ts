type EmbeddingsResponseStatus =
  | "success"
  | "error"
  | "rate_limited"
  | "cancelled";

interface EmbeddingsUsage {
  promptTokens?: number;
  totalTokens?: number;
}

export interface EmbeddingsResponse {
  status: EmbeddingsResponseStatus;
  /** Present iff status === "success"; output.length === input texts length. */
  output?: number[][];
  /** Human-readable detail when status !== "success". */
  message?: string;
  /** Model actually used. */
  model?: string;
  usage?: EmbeddingsUsage;
}

export interface EmbeddingProvider {
  /** Stable id, also stored on chunks to detect model changes. */
  readonly id: string;
  readonly dimensions: number;
  embed(
    texts: string[],
    options?: { signal?: AbortSignal },
  ): Promise<EmbeddingsResponse>;
}
