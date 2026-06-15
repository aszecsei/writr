import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../cosine";
import { FakeEmbeddingProvider } from "./fake-provider";

describe("FakeEmbeddingProvider", () => {
  it("returns one vector per input of the right dimension", async () => {
    const p = new FakeEmbeddingProvider(8);
    const res = await p.embed(["a", "b"]);
    expect(res.status).toBe("success");
    expect(res.output).toHaveLength(2);
    expect(res.output?.[0]).toHaveLength(8);
  });

  it("is deterministic and identical text is self-similar", async () => {
    const p = new FakeEmbeddingProvider(8);
    const a = (await p.embed(["hello"])).output?.[0] ?? [];
    const b = (await p.embed(["hello"])).output?.[0] ?? [];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);
  });

  it("returns cancelled when the signal is already aborted", async () => {
    const p = new FakeEmbeddingProvider(8);
    const res = await p.embed(["x"], { signal: AbortSignal.abort() });
    expect(res.status).toBe("cancelled");
  });
});
