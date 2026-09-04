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
  name: "Create Worldbuilding Doc",
  description:
    "Create a new worldbuilding document in the project's world bible. " +
    "Use for canonical world facts — magic systems, factions, geography, " +
    "history, lore. `content` is markdown. Pass `parentDocId` to nest the " +
    "doc under an existing one (omit for a top-level doc); `list` the " +
    "worldbuilding category first to discover parent ids.",
  inputSchema: z
    .object({
      title: z.string().min(1).describe("Document title"),
      content: z.string().describe("Document body (markdown)").optional(),
      tags: z
        .array(z.string())
        .describe("Free-form tags for categorization")
        .optional(),
      parentDocId: z
        .string()
        .describe("Id of the parent doc to nest under. Omit for top level.")
        .optional(),
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
  name: "Update Worldbuilding Doc",
  description:
    "Update fields on an existing worldbuilding document. Only include the " +
    "fields to change. Set `parentDocId` to a doc id to re-nest, or to null " +
    "to move it to the top level (moving a doc under one of its own " +
    "descendants is rejected). Use `list` / `get` first to discover the id.",
  inputSchema: z
    .object({
      id: z.string().min(1).describe("Worldbuilding doc id"),
      title: z.string().min(1).describe("New title").optional(),
      content: z.string().describe("New body (markdown)").optional(),
      tags: z.array(z.string()).describe("Replacement tag list").optional(),
      parentDocId: z
        .string()
        .describe("New parent doc id, or null to move to the top level.")
        .nullable()
        .optional(),
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
  name: "Delete Worldbuilding Doc",
  description:
    "Delete a worldbuilding document. Any child docs are re-parented to the " +
    "deleted doc's parent (they are NOT deleted). Use `list` / `get` first " +
    "to confirm the id.",
  inputSchema: z
    .object({
      id: z.string().min(1).describe("Worldbuilding doc id"),
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
  name: "Move Worldbuilding Doc",
  description:
    "Reorder a worldbuilding doc by moving it directly before or after a " +
    "sibling doc. Both docs must share the same parent — to move a doc under " +
    "a different parent, use update_worldbuilding_doc to re-nest it first. " +
    "Use the `list` / `get` tools first to discover the ids.",
  inputSchema: z
    .object({
      id: z.string().min(1).describe("Id of the doc to move"),
      targetId: z
        .string()
        .min(1)
        .describe("Id of the sibling doc to move next to"),
      position: z
        .enum(["before", "after"])
        .describe("Place the moved doc before or after the target"),
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
