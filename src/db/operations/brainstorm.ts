import { db } from "../database";
import {
  type BrainstormIdea,
  type BrainstormIdeaId,
  BrainstormIdeaSchema,
  type BrainstormSetup,
  type BrainstormSetupId,
  BrainstormSetupSchema,
} from "../schemas";
import { createCrud, generateId, now, stripUndefined } from "./helpers";

export type CreateBrainstormSetupInput = {
  name: string;
} & Partial<Pick<BrainstormSetup, "columns" | "pattern">>;

export async function createBrainstormSetup(
  input: CreateBrainstormSetupInput,
): Promise<BrainstormSetup> {
  const timestamp = now();
  const setup = BrainstormSetupSchema.parse({
    id: generateId(),
    name: input.name,
    columns: input.columns ?? [],
    pattern: input.pattern ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.brainstormSetups.add(setup);
  return setup;
}

const brainstormSetupCrud = createCrud<BrainstormSetup, BrainstormSetupId>(
  db.brainstormSetups,
);
export const getBrainstormSetup = brainstormSetupCrud.get;

/** All setups, most-recently updated first. */
export async function listBrainstormSetups(): Promise<BrainstormSetup[]> {
  const all = await db.brainstormSetups.toArray();
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function updateBrainstormSetup(
  id: BrainstormSetupId,
  data: Partial<Pick<BrainstormSetup, "name" | "columns" | "pattern">>,
): Promise<void> {
  await db.brainstormSetups.update(id, {
    ...stripUndefined(data),
    updatedAt: now(),
  });
}

/**
 * Delete a setup. Saved ideas produced from it are intentionally kept (their
 * `setupId` is a nullable, non-enforced reference), so a generated idea
 * survives deletion of the setup that produced it.
 */
export const deleteBrainstormSetup = brainstormSetupCrud.delete;

export type CreateBrainstormIdeaInput = {
  ideaText: string;
} & Partial<Pick<BrainstormIdea, "setupId">>;

export async function createBrainstormIdea(
  input: CreateBrainstormIdeaInput,
): Promise<BrainstormIdea> {
  const timestamp = now();
  const idea = BrainstormIdeaSchema.parse({
    id: generateId(),
    setupId: input.setupId ?? null,
    ideaText: input.ideaText,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.brainstormIdeas.add(idea);
  return idea;
}

/** All saved ideas, most-recently created first. */
export async function listBrainstormIdeas(): Promise<BrainstormIdea[]> {
  const all = await db.brainstormIdeas.toArray();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const deleteBrainstormIdea = createCrud<
  BrainstormIdea,
  BrainstormIdeaId
>(db.brainstormIdeas).delete;
