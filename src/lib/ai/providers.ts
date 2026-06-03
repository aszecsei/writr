import type { AiProvider } from "@/db/schemas";

export interface ProviderConfig {
  id: AiProvider;
  label: string;
  defaultModel: string;
  apiKeyPrefix: string;
}

export const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o",
    apiKeyPrefix: "sk-or-...",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-5-20250929",
    apiKeyPrefix: "sk-ant-...",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o",
    apiKeyPrefix: "sk-...",
  },
  grok: {
    id: "grok",
    label: "Grok (xAI)",
    defaultModel: "grok-3",
    apiKeyPrefix: "xai-...",
  },
  zai: {
    id: "zai",
    label: "z.ai (Zhipu AI)",
    defaultModel: "glm-4.7",
    apiKeyPrefix: "",
  },
  google: {
    id: "google",
    label: "Google AI Studio",
    defaultModel: "gemini-2.5-flash",
    apiKeyPrefix: "AIza...",
  },
  vertex: {
    id: "vertex",
    label: "Vertex AI",
    defaultModel: "gemini-2.5-flash",
    apiKeyPrefix: "project-id:location",
  },
};

export function getDefaultProviderModels(): Record<AiProvider, string> {
  return Object.fromEntries(
    Object.values(PROVIDERS).map((p) => [p.id, p.defaultModel]),
  ) as Record<AiProvider, string>;
}

/**
 * Empty defaults for TTS model/voice records. The Read Aloud button stays
 * hidden until the user fills these in for a TTS-capable provider
 * (OpenRouter today).
 */
export function getDefaultProviderTtsModels(): Record<AiProvider, string> {
  return Object.fromEntries(
    Object.values(PROVIDERS).map((p) => [p.id, ""]),
  ) as Record<AiProvider, string>;
}

export function getDefaultProviderTtsVoices(): Record<AiProvider, string> {
  return Object.fromEntries(
    Object.values(PROVIDERS).map((p) => [p.id, ""]),
  ) as Record<AiProvider, string>;
}
