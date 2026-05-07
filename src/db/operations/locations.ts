import { db } from "../database";
import {
  type Location,
  type LocationId,
  LocationSchema,
  type ProjectId,
} from "../schemas";
import { generateId, now } from "./helpers";

// ─── Locations ───────────────────────────────────────────────────────

export async function getLocationsByProject(
  projectId: ProjectId,
): Promise<Location[]> {
  return db.locations.where({ projectId }).sortBy("name");
}

export async function getLocation(
  id: LocationId,
): Promise<Location | undefined> {
  return db.locations.get(id);
}

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
  await db.locations.update(id, { ...data, updatedAt: now() });
}

export async function deleteLocation(id: LocationId): Promise<void> {
  await db.locations.delete(id);
}
