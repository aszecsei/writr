import { describe, expect, it } from "vitest";
import { normalizeAppSettings } from "@/db/schemas";

describe("normalizeAppSettings", () => {
  it("converts old API key fields to new format", () => {
    const old: Record<string, unknown> = {
      id: "app-settings",
      openRouterApiKey: "key-123",
      anthropicApiKey: "ant-456",
      preferredModel: "custom/model",
    };
    const result = normalizeAppSettings(old);
    expect(result.providerApiKeys).toEqual({
      openrouter: "key-123",
      anthropic: "ant-456",
      openai: "",
      grok: "",
      zai: "",
    });
    expect(result.providerModels).toEqual(
      expect.objectContaining({ openrouter: "custom/model" }),
    );
    expect(result.openRouterApiKey).toBeUndefined();
    expect(result.anthropicApiKey).toBeUndefined();
  });

  it("returns data unchanged if already in new format", () => {
    const data: Record<string, unknown> = {
      providerApiKeys: { openrouter: "x" },
      providerModels: { openrouter: "y" },
    };
    const result = normalizeAppSettings(data);
    expect(result).toBe(data);
  });
});
