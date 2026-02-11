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

const AiRequestSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1),
  provider: AiProviderEnum.default("openrouter"),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.union([z.string(), z.array(ContentPartSchema)]),
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

const encoder = new TextEncoder();

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

  const { adapter } = PROVIDERS[provider];

  const params: CompletionParams = {
    model,
    messages,
    temperature: temperature ?? 0.7,
    maxTokens: max_tokens ?? 2048,
    ...(reasoning ? { reasoning } : {}),
  };

  try {
    if (!stream) {
      const response = await adapter.complete(apiKey, params, request.signal);
      return NextResponse.json(response);
    }

    const gen = adapter.stream(apiKey, params, request.signal);
    const responseBody = new ReadableStream({
      async pull(controller) {
        try {
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
    const message = error instanceof Error ? error.message : "Unknown AI error";
    const status =
      error instanceof Error && "status" in error
        ? (error as { status: number }).status
        : 500;
    return NextResponse.json(
      { error: `${PROVIDERS[provider].label} API error`, details: message },
      { status },
    );
  }
}
