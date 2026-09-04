import { db } from "../database";
import {
  type ProjectId,
  type TimelineEvent,
  type TimelineEventId,
  TimelineEventSchema,
} from "../schemas";
import {
  createCrud,
  generateId,
  nextOrder,
  now,
  reorderEntities,
  stripUndefined,
} from "./helpers";

// ─── Timeline Events ────────────────────────────────────────────────

export async function getTimelineByProject(
  projectId: ProjectId,
): Promise<TimelineEvent[]> {
  return db.timelineEvents.where({ projectId }).sortBy("order");
}

const timelineEventCrud = createCrud<TimelineEvent, TimelineEventId>(
  db.timelineEvents,
);
export const getTimelineEvent = timelineEventCrud.get;

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
  const order = await nextOrder(
    db.timelineEvents,
    { projectId: data.projectId },
    data.order,
  );
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
  id: TimelineEventId,
  data: Partial<Omit<TimelineEvent, "id" | "projectId" | "createdAt">>,
): Promise<void> {
  await db.timelineEvents.update(id, {
    ...stripUndefined(data),
    updatedAt: now(),
  });
}

export const deleteTimelineEvent = timelineEventCrud.delete;

export async function reorderTimelineEvents(
  orderedIds: TimelineEventId[],
): Promise<void> {
  return reorderEntities(db.timelineEvents, orderedIds);
}
