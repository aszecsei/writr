import { beforeEach, describe, expect, it } from "vitest";
import { makeChapter, resetIdCounter } from "@/test/helpers";
import { db } from "../database";
import { reorderChapters, updateChapterContent } from "./chapters";

const projectId = "a1111111-1111-4111-a111-111111111111";

describe("reorderChapters", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.writingSessions.clear();
  });

  it("assigns sequential order values", async () => {
    const ch1 = makeChapter({ projectId, title: "One", order: 5 });
    const ch2 = makeChapter({ projectId, title: "Two", order: 10 });
    const ch3 = makeChapter({ projectId, title: "Three", order: 15 });
    await db.chapters.bulkAdd([ch1, ch2, ch3]);

    await reorderChapters([ch3.id, ch1.id, ch2.id]);

    const r1 = await db.chapters.get(ch3.id);
    const r2 = await db.chapters.get(ch1.id);
    const r3 = await db.chapters.get(ch2.id);
    expect(r1?.order).toBe(0);
    expect(r2?.order).toBe(1);
    expect(r3?.order).toBe(2);
  });

  it("handles a single chapter", async () => {
    const ch = makeChapter({ projectId, title: "Solo" });
    await db.chapters.add(ch);

    await reorderChapters([ch.id]);

    const result = await db.chapters.get(ch.id);
    expect(result?.order).toBe(0);
  });

  it("handles empty array without error", async () => {
    await expect(reorderChapters([])).resolves.toBeUndefined();
  });

  it("only changes order for specified chapters", async () => {
    const ch1 = makeChapter({ projectId, title: "Included", order: 5 });
    const ch2 = makeChapter({ projectId, title: "Excluded", order: 99 });
    await db.chapters.bulkAdd([ch1, ch2]);

    await reorderChapters([ch1.id]);

    const included = await db.chapters.get(ch1.id);
    const excluded = await db.chapters.get(ch2.id);
    expect(included?.order).toBe(0);
    expect(excluded?.order).toBe(99);
  });
});

describe("updateChapterContent", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.writingSessions.clear();
  });

  it("records a session when word count decreases", async () => {
    const ch = makeChapter({ projectId, title: "Ch", wordCount: 100 });
    await db.chapters.add(ch);

    await updateChapterContent(ch.id, "shorter content", 50);

    const sessions = await db.writingSessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].wordCountStart).toBe(100);
    expect(sessions[0].wordCountEnd).toBe(50);
  });

  it("does not throw for a nonexistent chapter ID", async () => {
    await expect(
      updateChapterContent(
        "00000000-0000-4000-8000-999999999999",
        "content",
        10,
      ),
    ).resolves.toBeUndefined();
  });

  it("updates content and wordCount in the database", async () => {
    const ch = makeChapter({
      projectId,
      title: "Ch",
      content: "old",
      wordCount: 1,
    });
    await db.chapters.add(ch);

    await updateChapterContent(ch.id, "new content here", 3);

    const updated = await db.chapters.get(ch.id);
    expect(updated?.content).toBe("new content here");
    expect(updated?.wordCount).toBe(3);
  });
});
