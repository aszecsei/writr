import { describe, expect, it } from "vitest";
import { IndexedChunkSchema } from "./schemas";

describe("IndexedChunkSchema", () => {
  it("parses a valid row", () => {
    const row = IndexedChunkSchema.parse({
      id: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      sourceType: "worldbuilding",
      sourceId: crypto.randomUUID(),
      chunkIndex: 0,
      text: "lore",
      contentHash: "deadbeef",
      vector: [0.1, 0.2],
      embeddingModel: "fake-v1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(row.sourceType).toBe("worldbuilding");
  });
});
