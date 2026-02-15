import type {
  AiMessage,
  AiResponse,
  AiStreamChunk,
  ReasoningEffort,
} from "../types";

export interface CompletionParams {
  model: string;
  messages: AiMessage[];
  temperature: number;
  maxTokens: number;
  reasoning?: { effort: ReasoningEffort };
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
