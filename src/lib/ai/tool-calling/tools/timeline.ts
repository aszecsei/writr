import { z } from "zod";
import {
  createTimelineEvent,
  deleteTimelineEvent,
  getTimelineByProject,
  getTimelineEvent,
  reorderTimelineEvents,
  updateTimelineEvent,
} from "@/db/operations/timeline";
import type { TimelineEventId } from "@/db/schemas";
import { defineTool } from "../types";
import { fail, ok, reorderRelative } from "./helpers";

export const createTimelineEventTool = defineTool({
  id: "create_timeline_event",
  name: "Create Timeline Event",
  description:
    "Add a timeline event. Use when the user asks to add events or plot points.",
  inputSchema: z
    .object({
      title: z.string().min(1).describe("Event title"),
      description: z.string().describe("Event description").optional(),
      date: z.string().describe("In-story date (freeform string)").optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const event = await createTimelineEvent({
      projectId: context.projectId,
      title: params.title,
      description: params.description ?? undefined,
      date: params.date ?? undefined,
    });
    return ok(`Created timeline event "${event.title}"`, {
      id: event.id,
      title: event.title,
    });
  },
});

export const updateTimelineEventTool = defineTool({
  id: "update_timeline_event",
  name: "Update Timeline Event",
  description:
    "Update fields on an existing timeline event. Only include fields to change. " +
    "Use the `list` and `get` tools first to discover the event id.",
  inputSchema: z
    .object({
      id: z.string().min(1).describe("Timeline event ID"),
      title: z.string().describe("New title").optional(),
      description: z.string().describe("New description").optional(),
      date: z.string().describe("New date").optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getTimelineEvent(id as TimelineEventId);
    if (!existing) return fail(`Timeline event not found: ${id}`);
    await updateTimelineEvent(id as TimelineEventId, fields);
    return ok(`Updated event "${existing.title}"`);
  },
});

export const deleteTimelineEventTool = defineTool({
  id: "delete_timeline_event",
  name: "Delete Timeline Event",
  description:
    "Delete a timeline event. Use the `list` and `get` tools first to " +
    "confirm the id.",
  inputSchema: z
    .object({
      id: z.string().min(1).describe("Timeline event ID"),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const existing = await getTimelineEvent(params.id as TimelineEventId);
    if (!existing) return fail(`Timeline event not found: ${params.id}`);
    await deleteTimelineEvent(params.id as TimelineEventId);
    return ok(`Deleted timeline event "${existing.title}"`);
  },
});

export const moveTimelineEventTool = defineTool({
  id: "move_timeline_event",
  name: "Move Timeline Event",
  description:
    "Reposition a timeline event by moving it directly before or after " +
    "another event. Use the `list` / `get` tools first to discover the ids.",
  inputSchema: z
    .object({
      id: z.string().min(1).describe("Id of the event to move"),
      targetId: z.string().min(1).describe("Id of the event to move next to"),
      position: z
        .enum(["before", "after"])
        .describe("Place the moved event before or after the target"),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const { id, targetId, position } = params;
    if (id === targetId) {
      return fail("Cannot move an event relative to itself.");
    }
    const events = await getTimelineByProject(context.projectId);
    const moving = events.find((e) => e.id === id);
    if (!moving) return fail(`Timeline event not found: ${id}`);
    const target = events.find((e) => e.id === targetId);
    if (!target) return fail(`Timeline event not found: ${targetId}`);

    const next = reorderRelative(
      events.map((e) => e.id),
      id as TimelineEventId,
      targetId as TimelineEventId,
      position,
    );
    await reorderTimelineEvents(next);
    return ok(`Moved "${moving.title}" ${position} "${target.title}"`);
  },
});
