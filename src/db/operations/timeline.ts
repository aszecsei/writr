import { db } from "../database";
import { type TimelineEvent, TimelineEventSchema } from "../schemas";
import { generateId, now, reorderEntities } from "./helpers";

// ─── Timeline Events ────────────────────────────────────────────────

export async function getTimelineByProject(
  projectId: string,
): Promise<TimelineEvent[]> {
  return db.timelineEvents.where({ projectId }).sortBy("order");
}

export async function getTimelineEvent(
  id: string,
): Promise<TimelineEvent | undefined> {
  return db.timelineEvents.get(id);
}

export async function createTimelineEvent(
  data: Pick<TimelineEvent, "projectId" | "title"> &
    Partial<
      Pick<
        TimelineEvent,
        | "description"
        | "date"
        | "order"
        | "linkedChapterIds"
        | "linkedCharacterIds"
      >
    >,
): Promise<TimelineEvent> {
  const order =
    data.order ??
    (await db.timelineEvents.where({ projectId: data.projectId }).count());
  const event = TimelineEventSchema.parse({
    id: generateId(),
    projectId: data.projectId,
    title: data.title,
    description: data.description ?? "",
    date: data.date ?? "",
    order,
    linkedChapterIds: data.linkedChapterIds ?? [],
    linkedCharacterIds: data.linkedCharacterIds ?? [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.timelineEvents.add(event);
  return event;
}

export async function updateTimelineEvent(
  id: string,
  data: Partial<Omit<TimelineEvent, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  await db.timelineEvents.update(id, { ...data, updatedAt: now() });
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  await db.timelineEvents.delete(id);
}

export async function reorderTimelineEvents(
  orderedIds: string[],
): Promise<void> {
  return reorderEntities(db.timelineEvents, orderedIds);
}
