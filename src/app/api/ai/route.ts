import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { AiProviderEnum } from "@/db/schemas";
import { PROVIDERS } from "@/lib/ai/providers";

const AiRequestSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1),
  provider: AiProviderEnum.default("openrouter"),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.union([
        z.string(),
        z.array(
          z.object({
            type: z.literal("text"),
            text: z.string(),
            cache_control: z
              .object({ type: z.literal("ephemeral") })
              .optional(),
          }),
        ),
      ]),
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
});

type ParsedMessage = z.infer<typeof AiRequestSchema>["messages"][number];

// ─── Anthropic helpers ──────────────────────────────────────────────

function normalizeAnthropicStopReason(
  stopReason: string | null | undefined,
): string {
  switch (stopReason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "stop_sequence":
      return "stop";
    default:
      return stopReason ?? "stop";
  }
}

interface AnthropicSystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

function buildAnthropicBody(
  model: string,
  messages: ParsedMessage[],
  temperature: number,
  maxTokens: number,
  stream: boolean,
  reasoning?: { effort: string },
) {
  // Extract system messages into top-level system parameter
  const systemBlocks: AnthropicSystemBlock[] = [];
  const nonSystemMessages: { role: "user" | "assistant"; content: string }[] =
    [];

  for (const msg of messages) {
    if (msg.role === "system") {
      if (typeof msg.content === "string") {
        systemBlocks.push({ type: "text", text: msg.content });
      } else {
        for (const part of msg.content) {
          systemBlocks.push({
            type: "text",
            text: part.text,
            ...(part.cache_control
              ? { cache_control: part.cache_control }
              : {}),
          });
        }
      }
    } else {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : msg.content.map((p) => p.text).join("");
      nonSystemMessages.push({ role: msg.role, content: text });
    }
  }

  const body: Record<string, unknown> = {
    model,
    messages: nonSystemMessages,
    max_tokens: maxTokens,
    stream,
  };

  if (systemBlocks.length > 0) {
    body.system = systemBlocks;
  }

  // Only set temperature for non-thinking requests
  if (!reasoning || reasoning.effort === "none") {
    body.temperature = temperature;
  }

  if (reasoning && reasoning.effort !== "none") {
    // Map reasoning effort to Anthropic's thinking parameter
    const budgetMap: Record<string, number> = {
      minimal: 1024,
      low: 4096,
      medium: 10240,
      high: 20480,
      xhigh: 32768,
    };
    body.thinking = {
      type: "enabled",
      budget_tokens: budgetMap[reasoning.effort] ?? 10240,
    };
  }

  return body;
}

function anthropicToOpenAiJson(data: Record<string, unknown>) {
  // Convert Anthropic Messages response to OpenAI-compatible format
  const content = Array.isArray(data.content)
    ? (data.content as { type: string; text?: string; thinking?: string }[])
    : [];

  let text = "";
  let reasoning = "";
  for (const block of content) {
    if (block.type === "text" && block.text) {
      text += block.text;
    } else if (block.type === "thinking" && block.thinking) {
      reasoning += block.thinking;
    }
  }

  return {
    id: data.id,
    model: data.model,
    choices: [
      {
        message: {
          role: "assistant",
          content: text,
          ...(reasoning ? { reasoning } : {}),
        },
        finish_reason: normalizeAnthropicStopReason(
          data.stop_reason as string | null | undefined,
        ),
      },
    ],
    usage: data.usage,
  };
}

function anthropicStreamAdapter(upstreamBody: ReadableStream): ReadableStream {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const json = trimmed.slice(6);
          if (json === "[DONE]") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          try {
            const event = JSON.parse(json);

            if (event.type === "content_block_delta") {
              const delta = event.delta;
              if (delta?.type === "text_delta" && delta.text) {
                const chunk = {
                  choices: [{ delta: { content: delta.text } }],
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
                );
              } else if (delta?.type === "thinking_delta" && delta.thinking) {
                const chunk = {
                  choices: [{ delta: { reasoning: delta.thinking } }],
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
                );
              }
            } else if (event.type === "message_delta") {
              const stopReason = event.delta?.stop_reason;
              if (stopReason) {
                const chunk = {
                  choices: [
                    {
                      delta: {},
                      finish_reason: normalizeAnthropicStopReason(stopReason),
                    },
                  ],
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
                );
              }
            } else if (event.type === "message_stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

// ─── Route handler ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = AiRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.prettifyError(parsed.error) },
      { status: 400 },
    );
  }

  const {
    apiKey,
    model,
    provider,
    messages,
    temperature,
    max_tokens,
    stream,
    reasoning,
  } = parsed.data;

  const providerConfig = PROVIDERS[provider];
  const isAnthropic = providerConfig.format === "anthropic";

  const effectiveTemp = temperature ?? 0.7;
  const effectiveMaxTokens = max_tokens ?? 2048;
  const effectiveStream = stream ?? false;

  let requestBody: string;
  if (isAnthropic) {
    requestBody = JSON.stringify(
      buildAnthropicBody(
        model,
        messages,
        effectiveTemp,
        effectiveMaxTokens,
        effectiveStream,
        reasoning,
      ),
    );
  } else {
    requestBody = JSON.stringify({
      model,
      messages,
      temperature: effectiveTemp,
      max_tokens: effectiveMaxTokens,
      stream: effectiveStream,
      ...(reasoning ? { reasoning } : {}),
    });
  }

  const upstreamResponse = await fetch(providerConfig.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...providerConfig.headers(apiKey),
    },
    body: requestBody,
  });

  if (!upstreamResponse.ok) {
    const errorBody = await upstreamResponse.text();
    return NextResponse.json(
      {
        error: `${providerConfig.label} API error`,
        status: upstreamResponse.status,
        details: errorBody,
      },
      { status: upstreamResponse.status },
    );
  }

  // Streaming response
  if (effectiveStream && upstreamResponse.body) {
    const responseBody = isAnthropic
      ? anthropicStreamAdapter(upstreamResponse.body)
      : upstreamResponse.body;

    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming response
  const data = await upstreamResponse.json();
  if (isAnthropic) {
    return NextResponse.json(anthropicToOpenAiJson(data));
  }
  return NextResponse.json(data);
}
