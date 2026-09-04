import { z } from "zod/v4";
import { AiProviderEnum, ReasoningEffortEnum } from "./ai";
import { ProjectDictionaryIdSchema, ProjectIdSchema } from "./ids";
import { timestamp } from "./shared";

// ─── App Dictionary (singleton) ─────────────────────────────────────

export const AppDictionarySchema = z.object({
  id: z.literal("app-dictionary"),
  words: z.array(z.string()).default([]),
  updatedAt: timestamp,
});
export type AppDictionary = z.infer<typeof AppDictionarySchema>;

// ─── Project Dictionary ─────────────────────────────────────────────

export const ProjectDictionarySchema = z.object({
  id: ProjectDictionaryIdSchema,
  projectId: ProjectIdSchema,
  words: z.array(z.string()).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ProjectDictionary = z.infer<typeof ProjectDictionarySchema>;

// ─── App Settings (singleton) ────────────────────────────────────────

const PrimaryColorEnum = z.enum([
  "blue",
  "indigo",
  "violet",
  "rose",
  "emerald",
  "amber",
  "teal",
  "orange",
  "cyan",
  "pink",
]);
export type PrimaryColor = z.infer<typeof PrimaryColorEnum>;

const NeutralColorEnum = z.enum(["zinc", "slate", "gray", "stone", "neutral"]);
export type NeutralColor = z.infer<typeof NeutralColorEnum>;

const EditorWidthEnum = z.enum(["narrow", "medium", "wide"]);
export type EditorWidth = z.infer<typeof EditorWidthEnum>;

const UiDensityEnum = z.enum(["compact", "comfortable"]);
export type UiDensity = z.infer<typeof UiDensityEnum>;

const GoalCountdownDisplayEnum = z.enum([
  "estimated-date",
  "time-remaining",
  "off",
]);
export type GoalCountdownDisplay = z.infer<typeof GoalCountdownDisplayEnum>;

/**
 * Delimiters wrapping a "hole" — a section the author intentionally skips,
 * usually holding a plaintext summary. See `src/lib/holes.ts`.
 */
const HoleDelimitersSchema = z.object({
  open: z.string().min(1).default("["),
  close: z.string().min(1).default("]"),
});

const RadioSettingsSchema = z.object({
  volume: z.number().min(0).max(100).default(80),
  muted: z.boolean().default(false),
  shuffleEnabled: z.boolean().default(false),
  loopMode: z.enum(["off", "all", "one"]).default("off"),
});
export type RadioSettings = z.infer<typeof RadioSettingsSchema>;

/**
 * Grammar categories (lint kinds) switched off by default. "Style" is noisy for
 * fiction prose, so it's off until the user opts in via the Grammar Rules modal.
 * Used both for the schema default and the modal's "Reset to defaults".
 */
export const DEFAULT_DISABLED_LINT_KINDS: string[] = ["Style"];

export const AppSettingsSchema = z.object({
  id: z.literal("app-settings"),
  enableAiFeatures: z.boolean().default(false),
  aiProvider: AiProviderEnum.default("openrouter"),
  providerApiKeys: z.record(AiProviderEnum, z.string()).default({
    openrouter: "",
    anthropic: "",
    openai: "",
    grok: "",
    zai: "",
    google: "",
    vertex: "",
  }),
  providerModels: z.record(AiProviderEnum, z.string()).default({
    openrouter: "openai/gpt-4o",
    anthropic: "claude-sonnet-4-5-20250929",
    openai: "gpt-4o",
    grok: "grok-3",
    zai: "glm-4.7",
    google: "gemini-2.5-flash",
    vertex: "gemini-2.5-flash",
  }),
  /**
   * Per-provider TTS model. Empty string hides the Read Aloud button.
   * Only OpenRouter is wired in the UI today; other entries exist solely
   * so the record stays a Record<AiProvider, string>.
   */
  providerTtsModels: z.record(AiProviderEnum, z.string()).default({
    openrouter: "",
    anthropic: "",
    openai: "",
    grok: "",
    zai: "",
    google: "",
    vertex: "",
  }),
  providerTtsVoices: z.record(AiProviderEnum, z.string()).default({
    openrouter: "",
    anthropic: "",
    openai: "",
    grok: "",
    zai: "",
    google: "",
    vertex: "",
  }),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  primaryColor: PrimaryColorEnum.default("blue"),
  neutralColor: NeutralColorEnum.default("zinc"),
  editorWidth: EditorWidthEnum.default("medium"),
  uiDensity: UiDensityEnum.default("comfortable"),
  autoSaveIntervalMs: z.number().int().positive().default(3000),
  editorFontSize: z.number().int().positive().default(16),
  editorFont: z.string().default("literata"),
  /** Master switch for the harper.js grammar/style checker in the editor. */
  grammarCheckerEnabled: z.boolean().default(false),
  /**
   * harper lint categories (lint kinds, e.g. "Style", "Punctuation") the user
   * has switched off. Applied as a post-hoc filter on results. Defaults to
   * {@link DEFAULT_DISABLED_LINT_KINDS}.
   */
  disabledLintKinds: z
    .array(z.string())
    .default(() => [...DEFAULT_DISABLED_LINT_KINDS]),
  /**
   * Per-rule overrides for harper's individual lint rules (rule key → enabled).
   * Only explicit overrides are stored; absent keys use harper's default.
   */
  grammarRuleOverrides: z.record(z.string(), z.boolean()).default({}),
  /** Master switch for the built-in spellchecker in the editor. */
  spellcheckEnabled: z.boolean().default(true),
  debugMode: z.boolean().default(false),
  streamResponses: z.boolean().default(true),
  reasoningEffort: ReasoningEffortEnum.default("medium"),
  readingSpeedWpm: z.number().int().positive().default(200),
  autoFocusModeOnSprint: z.boolean().default(false),
  goalCountdownDisplay: GoalCountdownDisplayEnum.default("estimated-date"),
  postChatInstructions: z.string().default(""),
  postChatInstructionsDepth: z.number().int().nonnegative().default(2),
  assistantPrefill: z.string().default(""),
  enableToolCalling: z.boolean().default(false),
  customSystemPrompt: z.string().nullable().default(null),
  lastExportedAt: z.string().datetime().nullable().default(null),
  holeDelimiters: HoleDelimitersSchema.default({ open: "[", close: "]" }),
  /**
   * Background translucency of hole highlights (0–1). Low while drafting so the
   * note recedes; high while editing so unfilled holes stand out.
   */
  holeHighlightOpacity: z.number().min(0).max(1).default(0.18),
  /** Master switch: embed & retrieve lore/scenes into chat context. */
  loreRetrievalEnabled: z.boolean().default(false),
  /** When true, future scenes are included in retrieval results. */
  omniscientMode: z.boolean().default(false),
  /** Number of lore chunks to surface per chat turn. */
  loreTopK: z.number().int().nonnegative().default(5),
  /** Number of scene chunks to surface per chat turn. */
  sceneTopK: z.number().int().nonnegative().default(3),
  /** Minimum cosine similarity score [−1, 1] for a chunk to be included. */
  similarityFloor: z.number().min(-1).max(1).default(0.3),
  /** Radio player preferences (volume, mute, shuffle, loop). */
  radio: RadioSettingsSchema.default({
    volume: 80,
    muted: false,
    shuffleEnabled: false,
    loopMode: "off",
  }),
  updatedAt: timestamp,
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// ─── Settings Normalization ─────────────────────────────────────────

/** Convert old per-provider API key fields to the new record format. */
export function normalizeAppSettings(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (data.providerApiKeys && data.providerModels) return data;

  const result = { ...data };

  if (!result.providerApiKeys) {
    result.providerApiKeys = {
      openrouter: (result.openRouterApiKey as string) ?? "",
      anthropic: (result.anthropicApiKey as string) ?? "",
      openai: (result.openAiApiKey as string) ?? "",
      grok: (result.grokApiKey as string) ?? "",
      zai: (result.zaiApiKey as string) ?? "",
    };
  }

  if (!result.providerModels) {
    result.providerModels = {
      openrouter: (result.preferredModel as string) ?? "openai/gpt-4o",
      anthropic: "claude-sonnet-4-5-20250929",
      openai: "gpt-4o",
      grok: "grok-3",
      zai: "glm-4.7",
    };
  }

  delete result.openRouterApiKey;
  delete result.anthropicApiKey;
  delete result.openAiApiKey;
  delete result.grokApiKey;
  delete result.zaiApiKey;
  delete result.preferredModel;

  return result;
}
