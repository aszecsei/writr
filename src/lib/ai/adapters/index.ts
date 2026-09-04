import type { AiProvider } from "@/db/schemas";
import { createAnthropicAdapter } from "./anthropic-adapter";
import { createGoogleAdapter } from "./google-adapter";
import { createOpenAiAdapter } from "./openai-adapter";
import type { ProviderAdapter } from "./types";

export { createAnthropicAdapter } from "./anthropic-adapter";
export { createGoogleAdapter } from "./google-adapter";
export { createOpenAiAdapter } from "./openai-adapter";
export type { CompletionParams, ProviderAdapter } from "./types";

/**
 * Live provider adapters. Imports the upstream SDKs (Anthropic/OpenAI/Google),
 * which pull in Node-only modules — keep this OUT of any `"use client"` import
 * graph. Only the `/api/ai` route should import it. Provider metadata for the
 * UI lives in `providers.ts`, which is client-safe.
 */
export const PROVIDER_ADAPTERS: Record<AiProvider, ProviderAdapter> = {
  openrouter: createOpenAiAdapter({
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://writr.app",
      "X-Title": "writr",
    },
  }),
  anthropic: createAnthropicAdapter(),
  openai: createOpenAiAdapter({ baseURL: "https://api.openai.com/v1" }),
  grok: createOpenAiAdapter({ baseURL: "https://api.x.ai/v1" }),
  zai: createOpenAiAdapter({ baseURL: "https://api.z.ai/api/paas/v4" }),
  google: createGoogleAdapter({ mode: "api-key" }),
  vertex: createGoogleAdapter({ mode: "vertex" }),
};
