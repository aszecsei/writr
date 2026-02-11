import type { AiMessage, AiResponse, AiStreamChunk } from "../types";

export interface CompletionParams {
  model: string;
  messages: AiMessage[];
  temperature: number;
  maxTokens: number;
  reasoning?: { effort: string };
}

export interface ProviderAdapter {
  complete(
    apiKey: string,
    params: CompletionParams,
    signal?: AbortSignal,
  ): Promise<AiResponse>;

  stream(
    apiKey: string,
    params: CompletionParams,
    signal?: AbortSignal,
  ): AsyncGenerator<AiStreamChunk>;
}
