import { z } from "zod";
import {
  createWorldbuildingDoc,
  deleteWorldbuildingDoc,
  getWorldbuildingDoc,
  getWorldbuildingDocsByProject,
  reorderWorldbuildingDocs,
  updateWorldbuildingDoc,
} from "@/db/operations/worldbuilding";
import type { WorldbuildingDocId } from "@/db/schemas";
import { defineTool } from "../types";
import { fail, ok, reorderRelative } from "./helpers";

export const createWorldbuildingDocTool = defineTool({
  id: "create_worldbuilding_doc",
  category: "worldbuilding",
  name: "Create Worldbuilding Doc",
  description:
    "Create a new worldbuilding document in the project's world bible. " +
    "Use for canonical world facts — magic systems, factions, geography, " +
    "history, lore. `content` is markdown. Pass `parentDocId` to nest the " +
    "doc under an existing one (omit for a top-level doc); `list` the " +
    "worldbuilding category first to discover parent ids.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Document title" },
      content: { type: "string", description: "Document body (markdown)" },
      tags: {
        type: "array",
        description: "Free-form tags for categorization",
        items: { type: "string" },
      },
      parentDocId: {
        type: "string",
        description: "Id of the parent doc to nest under. Omit for top level.",
      },
    },
    required: ["title"],
  },
  inputSchema: z
    .object({
      title: z.string().min(1),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
      parentDocId: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const doc = await createWorldbuildingDoc({
      projectId: context.projectId,
      title: params.title,
      content: params.content ?? undefined,
      tags: params.tags ?? undefined,
      parentDocId: (params.parentDocId as WorldbuildingDocId) ?? undefined,
    });
    return ok(`Created worldbuilding doc "${doc.title}"`, {
      id: doc.id,
      title: doc.title,
    });
  },
});

export const updateWorldbuildingDocTool = defineTool({
  id: "update_worldbuilding_doc",
  category: "worldbuilding",
  name: "Update Worldbuilding Doc",
  description:
    "Update fields on an existing worldbuilding document. Only include the " +
    "fields to change. Set `parentDocId` to a doc id to re-nest, or to null " +
    "to move it to the top level (moving a doc under one of its own " +
    "descendants is rejected). Use `list` / `get` first to discover the id.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Worldbuilding doc id" },
      title: { type: "string", description: "New title" },
      content: { type: "string", description: "New body (markdown)" },
      tags: {
        type: "array",
        description: "Replacement tag list",
        items: { type: "string" },
      },
      parentDocId: {
        type: "string",
        description: "New parent doc id, or null to move to the top level.",
      },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      title: z.string().min(1).optional(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
      parentDocId: z.string().nullable().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const { id, parentDocId, ...rest } = params;
    const existing = await getWorldbuildingDoc(id as WorldbuildingDocId);
    if (!existing) return fail(`Worldbuilding doc not found: ${id}`);

    const fields: Parameters<typeof updateWorldbuildingDoc>[1] = { ...rest };
    // `parentDocId` is forwarded only when present in the request so an
    // omitted key leaves the parent untouched, while an explicit null moves
    // the doc to the top level.
    if (parentDocId !== undefined) {
      fields.parentDocId = (parentDocId as WorldbuildingDocId) ?? null;
    }

    await updateWorldbuildingDoc(id as WorldbuildingDocId, fields);
    return ok(`Updated worldbuilding doc "${existing.title}"`);
  },
});

export const deleteWorldbuildingDocTool = defineTool({
  id: "delete_worldbuilding_doc",
  category: "worldbuilding",
  name: "Delete Worldbuilding Doc",
  description:
    "Delete a worldbuilding document. Any child docs are re-parented to the " +
    "deleted doc's parent (they are NOT deleted). Use `list` / `get` first " +
    "to confirm the id.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Worldbuilding doc id" },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const existing = await getWorldbuildingDoc(params.id as WorldbuildingDocId);
    if (!existing) return fail(`Worldbuilding doc not found: ${params.id}`);
    await deleteWorldbuildingDoc(params.id as WorldbuildingDocId);
    return ok(`Deleted worldbuilding doc "${existing.title}"`);
  },
});

export const moveWorldbuildingDocTool = defineTool({
  id: "move_worldbuilding_doc",
  category: "worldbuilding",
  name: "Move Worldbuilding Doc",
  description:
    "Reorder a worldbuilding doc by moving it directly before or after a " +
    "sibling doc. Both docs must share the same parent — to move a doc under " +
    "a different parent, use update_worldbuilding_doc to re-nest it first. " +
    "Use the `list` / `get` tools first to discover the ids.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Id of the doc to move" },
      targetId: {
        type: "string",
        description: "Id of the sibling doc to move next to",
      },
      position: {
        type: "string",
        description: "Place the moved doc before or after the target",
        enum: ["before", "after"],
      },
    },
    required: ["id", "targetId", "position"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      targetId: z.string().min(1),
      position: z.enum(["before", "after"]),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const { id, targetId, position } = params;
    if (id === targetId) {
      return fail("Cannot move a doc relative to itself.");
    }
    const moving = await getWorldbuildingDoc(id as WorldbuildingDocId);
    if (!moving) return fail(`Worldbuilding doc not found: ${id}`);
    const target = await getWorldbuildingDoc(targetId as WorldbuildingDocId);
    if (!target) return fail(`Worldbuilding doc not found: ${targetId}`);
    if (target.parentDocId !== moving.parentDocId) {
      return fail(
        "Both docs must share the same parent to reorder. Use " +
          "update_worldbuilding_doc to re-nest the doc first.",
      );
    }

    const all = await getWorldbuildingDocsByProject(context.projectId);
    const siblingIds = all
      .filter((d) => d.parentDocId === moving.parentDocId)
      .map((d) => d.id);
    const next = reorderRelative(
      siblingIds,
      id as WorldbuildingDocId,
      targetId as WorldbuildingDocId,
      position,
    );
    await reorderWorldbuildingDocs(next);
    return ok(`Moved "${moving.title}" ${position} "${target.title}"`);
  },
});
