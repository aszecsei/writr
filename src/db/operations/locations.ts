import { db } from "../database";
import {
  type Location,
  type LocationId,
  LocationSchema,
  type ProjectId,
} from "../schemas";
import { createCrud, generateId, now, stripUndefined } from "./helpers";

// ─── Locations ───────────────────────────────────────────────────────

export async function getLocationsByProject(
  projectId: ProjectId,
): Promise<Location[]> {
  return db.locations.where({ projectId }).sortBy("name");
}

const locationCrud = createCrud<Location, LocationId>(db.locations);
export const getLocation = locationCrud.get;

export async function createLocation(
  data: Pick<Location, "projectId" | "name"> &
    Partial<
      Pick<
        Location,
        | "description"
        | "parentLocationId"
        | "notes"
        | "linkedCharacterIds"
        | "images"
      >
    >,
): Promise<Location> {
  const location = LocationSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    name: data.name,
    description: data.description ?? "",
    parentLocationId: data.parentLocationId ?? null,
    notes: data.notes ?? "",
    linkedCharacterIds: data.linkedCharacterIds ?? [],
    images: data.images ?? [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.locations.add(location);
  return location;
}

export async function updateLocation(
  id: LocationId,
  data: Partial<Omit<Location, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  await db.locations.update(id, { ...stripUndefined(data), updatedAt: now() });
}

export const deleteLocation = locationCrud.delete;
