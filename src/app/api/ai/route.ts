import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { AiProviderEnum } from "@/db/schemas";
import type { CompletionParams } from "@/lib/ai/adapters";
import { PROVIDERS } from "@/lib/ai/providers";

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

const ToolParametersSchema = z.object({
  type: z.literal("object"),
  properties: z.record(
    z.string(),
    z.object({
      type: z.string(),
      description: z.string().optional(),
      enum: z.array(z.string()).optional(),
    }),
  ),
  required: z.array(z.string()).optional(),
});

const ToolDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  parameters: ToolParametersSchema,
});

const ChatRequestSchema = z.object({
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

const TtsRequestSchema = z.object({
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

const AiRequestSchema = z.discriminatedUnion("action", [
  ChatRequestSchema,
  TtsRequestSchema,
]);

const encoder = new TextEncoder();

interface UpstreamErrorBody {
  message?: string;
  code?: number | string;
  metadata?: unknown;
  type?: string;
}

function extractUpstreamError(error: unknown): {
  status: number;
  message: string;
  upstream?: UpstreamErrorBody;
} {
  if (!(error instanceof Error)) {
    return { status: 500, message: "Unknown AI error" };
  }
  const status =
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;
  // OpenAI SDK APIError exposes the parsed response body on `.error`
  const upstream = (error as { error?: UpstreamErrorBody }).error;
  return { status, message: error.message, upstream };
}

function logUpstreamError(provider: string, error: unknown) {
  const { status, message, upstream } = extractUpstreamError(error);
  console.error(
    `[AI] ${provider} request failed (status ${status}): ${message}`,
    upstream ? `\nUpstream body: ${JSON.stringify(upstream, null, 2)}` : "",
  );
}

function errorResponse(provider: string, error: unknown) {
  const { status, message, upstream } = extractUpstreamError(error);
  return NextResponse.json(
    {
      error: `${PROVIDERS[provider as keyof typeof PROVIDERS]?.label ?? provider} API error`,
      details: message,
      upstream,
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Zod's discriminated union doesn't support defaults on the discriminator,
  // so default to "chat" here. Older callers (no `action` field) keep working
  // with no client-side changes.
  if (body && typeof body === "object" && body.action == null) {
    body.action = "chat";
  }
  const parsed = AiRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.prettifyError(parsed.error) },
      { status: 400 },
    );
  }

  if (parsed.data.action === "tts") {
    const { apiKey, provider, model, voice, text, format } = parsed.data;
    const { adapter } = PROVIDERS[provider];
    if (!adapter.tts) {
      return NextResponse.json(
        {
          error: "TTS not supported",
          details: `Provider "${provider}" does not support text-to-speech.`,
        },
        { status: 400 },
      );
    }
    try {
      const result = await adapter.tts(
        apiKey,
        { model, voice, text, format },
        request.signal,
      );
      return new NextResponse(result.audio, {
        headers: {
          "Content-Type": result.audio.type || "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      logUpstreamError(provider, error);
      return errorResponse(provider, error);
    }
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
    tools,
  } = parsed.data;

  const { adapter } = PROVIDERS[provider];

  const params: CompletionParams = {
    model,
    messages,
    temperature: temperature ?? 0.7,
    maxTokens: max_tokens ?? 2048,
    ...(reasoning ? { reasoning } : {}),
    ...(tools?.length
      ? {
          tools:
            tools as import("@/lib/ai/tool-calling").ToolDefinitionForModel[],
        }
      : {}),
  };

  try {
    if (!stream) {
      const response = await adapter.complete(apiKey, params, request.signal);
      return NextResponse.json(response);
    }

    const gen = adapter.stream(apiKey, params, request.signal);

    // Drive the first iteration before opening the SSE response so upstream
    // 4xx/5xx errors surface as JSON instead of a half-streamed broken pipe.
    let primed: IteratorResult<unknown> | undefined;
    try {
      primed = await gen.next();
    } catch (error) {
      logUpstreamError(provider, error);
      return errorResponse(provider, error);
    }

    const responseBody = new ReadableStream({
      async pull(controller) {
        try {
          if (primed) {
            const current = primed;
            primed = undefined;
            if (current.done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(current.value)}\n\n`),
            );
            return;
          }
          const { done, value } = await gen.next();
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(value)}\n\n`),
          );
        } catch (error) {
          logUpstreamError(provider, error);
          controller.error(error);
        }
      },
      cancel() {
        gen.return(undefined);
      },
    });

    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    logUpstreamError(provider, error);
    return errorResponse(provider, error);
  }
}
