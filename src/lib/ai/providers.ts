import type { AiProvider } from "@/db/schemas";
import {
  createAnthropicAdapter,
  createGoogleAdapter,
  createOpenAiAdapter,
  type ProviderAdapter,
} from "./adapters";

export interface ProviderConfig {
  id: AiProvider;
  label: string;
  defaultModel: string;
  apiKeyPrefix: string;
  adapter: ProviderAdapter;
}

export const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o",
    apiKeyPrefix: "sk-or-...",
    adapter: createOpenAiAdapter({
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://writr.app",
        "X-Title": "writr",
      },
    }),
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-5-20250929",
    apiKeyPrefix: "sk-ant-...",
    adapter: createAnthropicAdapter(),
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o",
    apiKeyPrefix: "sk-...",
    adapter: createOpenAiAdapter({ baseURL: "https://api.openai.com/v1" }),
  },
  grok: {
    id: "grok",
    label: "Grok (xAI)",
    defaultModel: "grok-3",
    apiKeyPrefix: "xai-...",
    adapter: createOpenAiAdapter({ baseURL: "https://api.x.ai/v1" }),
  },
  zai: {
    id: "zai",
    label: "z.ai (Zhipu AI)",
    defaultModel: "glm-4.7",
    apiKeyPrefix: "",
    adapter: createOpenAiAdapter({
      baseURL: "https://api.z.ai/api/paas/v4",
    }),
  },
  google: {
    id: "google",
    label: "Google AI Studio",
    defaultModel: "gemini-2.5-flash",
    apiKeyPrefix: "AIza...",
    adapter: createGoogleAdapter({ mode: "api-key" }),
  },
  vertex: {
    id: "vertex",
    label: "Vertex AI",
    defaultModel: "gemini-2.5-flash",
    apiKeyPrefix: "project-id:location",
    adapter: createGoogleAdapter({ mode: "vertex" }),
  },
};

export function getDefaultProviderModels(): Record<AiProvider, string> {
  return Object.fromEntries(
    Object.values(PROVIDERS).map((p) => [p.id, p.defaultModel]),
  ) as Record<AiProvider, string>;
}
