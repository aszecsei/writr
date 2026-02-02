import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";

const AiRequestSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  reasoning: z
    .object({
      effort: z.enum(["xhigh", "high", "medium", "low", "minimal"]),
    })
    .optional(),
});

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
    messages,
    temperature,
    max_tokens,
    stream,
    reasoning,
  } = parsed.data;

  const openRouterResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://writr.app",
        "X-Title": "writr",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 2048,
        stream: stream ?? false,
        ...(reasoning ? { reasoning } : {}),
      }),
    },
  );

  if (!openRouterResponse.ok) {
    const errorBody = await openRouterResponse.text();
    return NextResponse.json(
      {
        error: "OpenRouter API error",
        status: openRouterResponse.status,
        details: errorBody,
      },
      { status: openRouterResponse.status },
    );
  }

  if (stream && openRouterResponse.body) {
    return new NextResponse(openRouterResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const data = await openRouterResponse.json();
  return NextResponse.json(data);
}
