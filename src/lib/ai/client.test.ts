import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeChapter } from "./client";

const SETTINGS = { apiKey: "k", model: "m", provider: "openai" as const };

function mockFetch(impl: () => Promise<Response> | Response) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("summarizeChapter", () => {
  it("posts the chapter prompt to /api/ai and returns the content", async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ content: "A summary." }),
      } as Response),
    );

    const out = await summarizeChapter("Ch 1", "Body text", SETTINGS);

    expect(out).toBe("A summary.");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/ai");
    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(false);
    expect(body.messages[1].content).toBe(
      '<chapter title="Ch 1">\nBody text\n</chapter>',
    );
  });

  it("throws the extracted upstream message on a non-ok response", async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ upstream: { metadata: { raw: "rate limited" } } }),
      } as Response),
    );

    await expect(summarizeChapter("Ch 1", "Body", SETTINGS)).rejects.toThrow(
      "rate limited",
    );
  });
});
