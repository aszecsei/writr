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

const AiRequestSchema = z.object({
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
