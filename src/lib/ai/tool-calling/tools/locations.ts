import { z } from "zod";
import {
  createLocation,
  deleteLocation,
  getLocation,
  updateLocation,
} from "@/db/operations/locations";
import type { LocationId } from "@/db/schemas";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

export const createLocationTool = defineTool({
  id: "create_location",
  name: "Create Location",
  description:
    "Create a new location in the story bible. Use when the user asks to add a setting or place.",
  inputSchema: z.object({
    name: z.string().min(1).describe("Location name"),
    description: z.string().describe("Location description").optional(),
    notes: z.string().describe("Additional notes").optional(),
  }),
  requiresApproval: true,
  async execute(params, context) {
    const location = await createLocation({
      projectId: context.projectId,
      name: params.name,
      description: params.description,
      notes: params.notes,
    });
    return ok(`Created location "${location.name}"`, {
      id: location.id,
      name: location.name,
    });
  },
});

export const updateLocationTool = defineTool({
  id: "update_location",
  name: "Update Location",
  description:
    "Update fields on an existing location. Only include fields to change. " +
    "Use the `list` and `get` tools first to discover the location id.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Location ID"),
    name: z.string().describe("New name").optional(),
    description: z.string().describe("New description").optional(),
    notes: z.string().describe("New notes").optional(),
  }),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getLocation(id as LocationId);
    if (!existing) return fail(`Location not found: ${id}`);
    await updateLocation(id as LocationId, fields);
    return ok(`Updated location "${existing.name}"`);
  },
});

export const deleteLocationTool = defineTool({
  id: "delete_location",
  name: "Delete Location",
  description:
    "Delete a location from the story bible. Use the `list` and `get` tools " +
    "first to confirm the id.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Location ID"),
  }),
  requiresApproval: true,
  async execute(params) {
    const existing = await getLocation(params.id as LocationId);
    if (!existing) return fail(`Location not found: ${params.id}`);
    await deleteLocation(params.id as LocationId);
    return ok(`Deleted location "${existing.name}"`);
  },
});
