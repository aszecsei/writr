import type { AiProvider } from "@/db/schemas";

export interface ProviderConfig {
  id: AiProvider;
  label: string;
  baseUrl: string;
  headers: (apiKey: string) => Record<string, string>;
  defaultModel: string;
  apiKeyPrefix: string;
  format: "openai" | "anthropic";
}

export const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    headers: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://writr.app",
      "X-Title": "writr",
    }),
    defaultModel: "openai/gpt-4o",
    apiKeyPrefix: "sk-or-...",
    format: "openai",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1/messages",
    headers: (apiKey) => ({
      "x-api-key": apiKey,
      "anthropic-version": "2024-10-22",
    }),
    defaultModel: "claude-sonnet-4-5-20250929",
    apiKeyPrefix: "sk-ant-...",
    format: "anthropic",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    headers: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    defaultModel: "gpt-4o",
    apiKeyPrefix: "sk-...",
    format: "openai",
  },
  grok: {
    id: "grok",
    label: "Grok (xAI)",
    baseUrl: "https://api.x.ai/v1/chat/completions",
    headers: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    defaultModel: "grok-3",
    apiKeyPrefix: "xai-...",
    format: "openai",
  },
  zai: {
    id: "zai",
    label: "z.ai (Zhipu AI)",
    baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
    headers: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
    defaultModel: "glm-4.7",
    apiKeyPrefix: "",
    format: "openai",
  },
};

export function getDefaultProviderModels(): Record<AiProvider, string> {
  return Object.fromEntries(
    Object.values(PROVIDERS).map((p) => [p.id, p.defaultModel]),
  ) as Record<AiProvider, string>;
}
