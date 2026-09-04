import { z } from "zod/v4";
import { AiProviderEnum } from "@/db/schemas";
import type {
  ToolDefinitionForModel,
  ToolParameterProperty,
  ToolParametersSchema as ToolParametersType,
} from "@/lib/ai/tool-calling";

const TextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  cache_control: z.object({ type: z.literal("ephemeral") }).optional(),
});

const ImageUrlPartSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({ url: z.string() }),
});

const ContentPartSchema = z.union([TextPartSchema, ImageUrlPartSchema]);

const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
});

const ToolParameterPropertySchema: z.ZodType<ToolParameterProperty> = z.lazy(
  () =>
    z.object({
      type: z.string(),
      description: z.string().optional(),
      enum: z.array(z.string()).optional(),
      items: ToolParameterPropertySchema.optional(),
      properties: z.record(z.string(), ToolParameterPropertySchema).optional(),
      required: z.array(z.string()).optional(),
    }),
);

const ToolParametersSchema: z.ZodType<ToolParametersType> = z.object({
  type: z.literal("object"),
  properties: z.record(z.string(), ToolParameterPropertySchema),
  required: z.array(z.string()).optional(),
});

const ToolDefinitionSchema: z.ZodType<ToolDefinitionForModel> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  parameters: ToolParametersSchema,
});

export const ChatRequestSchema = z.object({
  action: z.literal("chat"),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  provider: AiProviderEnum.default("openrouter"),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant", "tool"]),
      content: z.union([z.string(), z.array(ContentPartSchema)]),
      toolCalls: z.array(ToolCallSchema).optional(),
      toolCallId: z.string().optional(),
    }),
  ),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  reasoning: z
    .object({
      effort: z.enum(["xhigh", "high", "medium", "low", "minimal", "none"]),
    })
    .optional(),
  tools: z.array(ToolDefinitionSchema).optional(),
});

export const TtsRequestSchema = z.object({
  action: z.literal("tts"),
  apiKey: z.string().min(1),
  provider: AiProviderEnum,
  model: z.string().min(1),
  voice: z.string().min(1),
  // Hard cap to keep individual requests well within OpenRouter's input
  // limits. The client chunker should keep these to ~4000.
  text: z.string().min(1).max(8000),
  format: z.enum(["mp3", "wav"]).optional(),
});

export const AiRequestSchema = z.discriminatedUnion("action", [
  ChatRequestSchema,
  TtsRequestSchema,
]);

export {
  ToolDefinitionSchema,
  ToolParameterPropertySchema,
  ToolParametersSchema,
};
