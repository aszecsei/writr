import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId, TimelineEventId } from "@/db/schemas";
import { makeTimelineEvent, resetIdCounter } from "@/test/helpers";
import { executeTool } from "../tools";

const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;
const ctx = { projectId };

describe("timeline event tools", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.timelineEvents.clear();
  });

  it("create_timeline_event creates an event", async () => {
    const result = await executeTool(
      "create_timeline_event",
      { title: "The Battle", date: "Year 5, Day 3" },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("The Battle");
  });

  it("update_timeline_event modifies fields", async () => {
    const created = await executeTool(
      "create_timeline_event",
      { title: "Feast" },
      ctx,
    );
    await executeTool(
      "update_timeline_event",
      { id: created.data?.id as string, description: "A grand feast" },
      ctx,
    );

    const updated = await db.timelineEvents.get(
      created.data?.id as TimelineEventId,
    );
    expect(updated?.description).toBe("A grand feast");
  });

  it("delete_timeline_event removes the event", async () => {
    const event = makeTimelineEvent({ projectId, title: "The Coronation" });
    await db.timelineEvents.add(event);

    const result = await executeTool(
      "delete_timeline_event",
      { id: event.id },
      ctx,
    );
    expect(result.success).toBe(true);
    expect(await db.timelineEvents.get(event.id)).toBeUndefined();
  });

  it("move_timeline_event repositions an event after a target", async () => {
    const a = makeTimelineEvent({ projectId, title: "A", order: 0 });
    const b = makeTimelineEvent({ projectId, title: "B", order: 1 });
    const c = makeTimelineEvent({ projectId, title: "C", order: 2 });
    await db.timelineEvents.bulkAdd([a, b, c]);

    // Move A to sit after C → order becomes B, C, A.
    const result = await executeTool(
      "move_timeline_event",
      { id: a.id, targetId: c.id, position: "after" },
      ctx,
    );
    expect(result.success).toBe(true);

    expect((await db.timelineEvents.get(b.id))?.order).toBe(0);
    expect((await db.timelineEvents.get(c.id))?.order).toBe(1);
    expect((await db.timelineEvents.get(a.id))?.order).toBe(2);
  });

  it("move_timeline_event places an event before a target", async () => {
    const a = makeTimelineEvent({ projectId, title: "A", order: 0 });
    const b = makeTimelineEvent({ projectId, title: "B", order: 1 });
    const c = makeTimelineEvent({ projectId, title: "C", order: 2 });
    await db.timelineEvents.bulkAdd([a, b, c]);

    // Move C before A → order becomes C, A, B.
    await executeTool(
      "move_timeline_event",
      { id: c.id, targetId: a.id, position: "before" },
      ctx,
    );

    expect((await db.timelineEvents.get(c.id))?.order).toBe(0);
    expect((await db.timelineEvents.get(a.id))?.order).toBe(1);
    expect((await db.timelineEvents.get(b.id))?.order).toBe(2);
  });

  it("move_timeline_event fails for an unknown target", async () => {
    const a = makeTimelineEvent({ projectId, title: "A" });
    await db.timelineEvents.add(a);
    const result = await executeTool(
      "move_timeline_event",
      {
        id: a.id,
        targetId: "00000000-0000-4000-8000-deadbeefdead",
        position: "after",
      },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });
});
