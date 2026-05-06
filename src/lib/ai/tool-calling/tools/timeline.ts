import { z } from "zod";
import {
  createTimelineEvent,
  getTimelineEvent,
  updateTimelineEvent,
} from "@/db/operations/timeline";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

export const createTimelineEventTool = defineTool({
  id: "create_timeline_event",
  category: "timeline",
  name: "Create Timeline Event",
  description:
    "Add a timeline event. Use when the user asks to add events or plot points.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Event title" },
      description: { type: "string", description: "Event description" },
      date: {
        type: "string",
        description: "In-story date (freeform string)",
      },
    },
    required: ["title"],
  },
  inputSchema: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      date: z.string().optional(),
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
  category: "timeline",
  name: "Update Timeline Event",
  description:
    "Update fields on an existing timeline event. Only include fields to change. " +
    "Use the `list` and `get` tools first to discover the event id.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Timeline event ID" },
      title: { type: "string", description: "New title" },
      description: { type: "string", description: "New description" },
      date: { type: "string", description: "New date" },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      description: z.string().optional(),
      date: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getTimelineEvent(id);
    if (!existing) return fail(`Timeline event not found: ${id}`);
    await updateTimelineEvent(id, fields);
    return ok(`Updated event "${existing.title}"`);
  },
});
