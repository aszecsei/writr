import { z } from "zod/v4";

/**
 * A provider reasoning block that must be echoed back verbatim on the next
 * request of a tool-calling loop. Anthropic rejects a tool_result turn whose
 * preceding assistant turn dropped its signed thinking blocks, so the runner
 * carries them on the assistant `AiMessage` alongside its tool calls.
 */
export const ThinkingBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("thinking"),
    thinking: z.string(),
    signature: z.string(),
  }),
  z.object({
    type: z.literal("redacted_thinking"),
    data: z.string(),
  }),
]);

export type ThinkingBlock = z.infer<typeof ThinkingBlockSchema>;
