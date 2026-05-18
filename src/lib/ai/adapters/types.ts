import type { ToolDefinitionForModel } from "../tool-calling";
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
  tools?: ToolDefinitionForModel[];
}

export interface TtsParams {
  model: string;
  voice: string;
  text: string;
  format?: "mp3" | "wav";
}

export interface TtsResult {
  audio: Blob;
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

  /**
   * Synthesize speech for `params.text`. Only implemented by adapters whose
   * upstream exposes a chat-style TTS endpoint (today: OpenRouter via the
   * OpenAI-compatible adapter).
   *
   * Returns the entire audio response as a single Blob. Callers split long
   * inputs into chunks themselves (see src/lib/tts/chunk.ts) — the adapter
   * neither chunks nor streams audio.
   */
  tts?(
    apiKey: string,
    params: TtsParams,
    signal?: AbortSignal,
  ): Promise<TtsResult>;
}
