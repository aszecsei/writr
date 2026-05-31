import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createComment } from "@/db/operations/comments";
import type { ProjectId } from "@/db/schemas";
import {
  BETA_READER_PANEL_PROMPT,
  BETA_READER_PERSONA_ATTRIBUTION,
  extractPersonaPrompts,
} from "@/lib/ai/agents/builtins/betaReader";
import { makeChapter, resetIdCounter } from "@/test/helpers";
import { executeTool } from "../tools";
import type { ToolExecutionContext } from "../types";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const otherProjectId = "a2222222-2222-4222-a222-222222222222" as ProjectId;

async function seedChapter(content: string, project: ProjectId = projectId) {
  const chapter = makeChapter({
    projectId: project,
    title: "Chapter 1",
    content,
  });
  await db.chapters.add(chapter);
  return chapter;
}

const ctx: ToolExecutionContext = { projectId };

describe("add_comment", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.comments.clear();
  });

  it("creates a comment with persona attribution on a unique anchor", async () => {
    const chapter = await seedChapter(
      "The dog ran swiftly down the road. The cat watched.",
    );

    const result = await executeTool(
      "add_comment",
      {
        chapterId: chapter.id,
        anchorText: "ran swiftly down",
        content: "this rhythm is great",
        persona: "maya",
      },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data?.persona).toBe("maya");

    const comments = await db.comments.toArray();
    expect(comments).toHaveLength(1);
    const c = comments[0];
    expect(c.author).toBe(BETA_READER_PERSONA_ATTRIBUTION.maya.name);
    expect(c.authorColor).toBe(
      BETA_READER_PERSONA_ATTRIBUTION.maya.authorColor,
    );
    expect(c.color).toBe(BETA_READER_PERSONA_ATTRIBUTION.maya.color);
    expect(c.anchorText).toBe("ran swiftly down");
    expect(c.content).toBe("this rhythm is great");
    expect(c.parentCommentId).toBeNull();
    // Placeholder positions — the tool writes 1 / 1 + anchorText.length
    // because it has no live editor to compute true PM positions from.
    // `reconcileComment` resolves real PM positions from `anchorText` via
    // `findAnchorPositionInDoc` when the chapter opens in the editor.
    expect(c.fromOffset).toBe(1);
    expect(c.toOffset).toBe(1 + "ran swiftly down".length);
  });

  it("disambiguates a repeated anchor using prefix and suffix", async () => {
    const chapter = await seedChapter("the good dog and the bad dog ran home");

    const result = await executeTool(
      "add_comment",
      {
        chapterId: chapter.id,
        prefix: "the bad ",
        anchorText: "dog",
        suffix: " ran",
        content: "love the contrast",
        persona: "anton",
      },
      ctx,
    );

    expect(result.success).toBe(true);
    const comments = await db.comments.toArray();
    expect(comments).toHaveLength(1);
    expect(comments[0].anchorText).toBe("dog");
    expect(comments[0].author).toBe("Anton");
  });

  it("fails when the anchor isn't found", async () => {
    const chapter = await seedChapter("a fairly short chapter");

    const result = await executeTool(
      "add_comment",
      {
        chapterId: chapter.id,
        anchorText: "missing phrase",
        content: "shouldn't land",
        persona: "joan",
      },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/);
    expect(await db.comments.toArray()).toHaveLength(0);
  });

  it("fails when the combined anchor matches multiple times", async () => {
    const chapter = await seedChapter("dog dog dog");

    const result = await executeTool(
      "add_comment",
      {
        chapterId: chapter.id,
        anchorText: "dog",
        content: "which one",
        persona: "joan",
      },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not unique/);
    expect(result.message).toMatch(/widen prefix/);
    expect(await db.comments.toArray()).toHaveLength(0);
  });

  it("tolerates curly vs straight quotes when locating the anchor", async () => {
    // Chapter has curly quotes (publishing-friendly); model uses straight.
    const chapter = await seedChapter("She said “hello” softly.");

    const result = await executeTool(
      "add_comment",
      {
        chapterId: chapter.id,
        anchorText: 'said "hello"',
        content: "warm beat",
        persona: "maya",
      },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(await db.comments.toArray()).toHaveLength(1);
  });

  it("rejects a chapter that belongs to a different project", async () => {
    const chapter = await seedChapter("content", otherProjectId);

    const result = await executeTool(
      "add_comment",
      {
        chapterId: chapter.id,
        anchorText: "content",
        content: "nope",
        persona: "joan",
      },
      ctx, // ctx's projectId doesn't match the chapter
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/different project/);
  });
});

describe("reply_to_comment", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.comments.clear();
  });

  it("creates a reply inheriting position and anchorText from the parent", async () => {
    const chapter = await seedChapter("The dog ran swiftly down the road.");
    const parent = await createComment({
      projectId,
      chapterId: chapter.id,
      fromOffset: 5,
      toOffset: 24,
      anchorText: "dog ran swiftly down",
      content: "Maya's reaction",
      author: "Maya",
      authorColor: BETA_READER_PERSONA_ATTRIBUTION.maya.authorColor,
      color: "green",
    });

    const result = await executeTool(
      "reply_to_comment",
      {
        parentCommentId: parent.id,
        content: "but is it earned?",
        persona: "joan",
      },
      ctx,
    );

    expect(result.success).toBe(true);
    expect(result.data?.parentCommentId).toBe(parent.id);

    const replies = await db.comments
      .where("parentCommentId")
      .equals(parent.id)
      .toArray();
    expect(replies).toHaveLength(1);
    const reply = replies[0];
    expect(reply.author).toBe("Joan");
    expect(reply.authorColor).toBe(
      BETA_READER_PERSONA_ATTRIBUTION.joan.authorColor,
    );
    expect(reply.color).toBe(BETA_READER_PERSONA_ATTRIBUTION.joan.color);
    expect(reply.fromOffset).toBe(parent.fromOffset);
    expect(reply.toOffset).toBe(parent.toOffset);
    expect(reply.anchorText).toBe(parent.anchorText);
    expect(reply.chapterId).toBe(parent.chapterId);
    expect(reply.parentCommentId).toBe(parent.id);
  });

  it("fails when the parent comment doesn't exist", async () => {
    const missingId = "a9999999-9999-4999-a999-999999999999";

    const result = await executeTool(
      "reply_to_comment",
      {
        parentCommentId: missingId,
        content: "ghost reply",
        persona: "anton",
      },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/);
  });

  it("rejects a parent comment in a different project", async () => {
    const chapter = await seedChapter("content", otherProjectId);
    const parent = await createComment({
      projectId: otherProjectId,
      chapterId: chapter.id,
      fromOffset: 1,
      toOffset: 8,
      anchorText: "content",
      content: "from other project",
    });

    const result = await executeTool(
      "reply_to_comment",
      {
        parentCommentId: parent.id,
        content: "cross-project reply",
        persona: "anton",
      },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/different project/);
  });

  it("rejects replying to a reply (flat threads only)", async () => {
    const chapter = await seedChapter("body");
    const root = await createComment({
      projectId,
      chapterId: chapter.id,
      fromOffset: 1,
      toOffset: 5,
      anchorText: "body",
      content: "root",
    });
    const firstReply = await createComment({
      projectId,
      chapterId: chapter.id,
      fromOffset: 1,
      toOffset: 5,
      anchorText: "body",
      content: "reply",
      parentCommentId: root.id,
    });

    const result = await executeTool(
      "reply_to_comment",
      {
        parentCommentId: firstReply.id,
        content: "second-level reply",
        persona: "joan",
      },
      ctx,
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/cannot reply to a reply/);
  });
});

describe("extractPersonaPrompts", () => {
  it("returns non-empty briefs for all three personas", () => {
    const out = extractPersonaPrompts(BETA_READER_PANEL_PROMPT);
    expect(Object.keys(out).sort()).toEqual(["anton", "joan", "maya"]);
    for (const id of ["maya", "anton", "joan"] as const) {
      expect(out[id].length).toBeGreaterThan(50);
    }
  });

  it("throws when a persona block is missing", () => {
    const broken = '<persona id="maya" name="Maya">hi</persona>';
    expect(() => extractPersonaPrompts(broken)).toThrow(/anton/);
  });
});
