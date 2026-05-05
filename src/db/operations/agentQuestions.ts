import { db } from "../database";
import {
  type AgentQuestion,
  AgentQuestionSchema,
  type AgentQuestionStatus,
  type AgentReference,
} from "../schemas";
import { generateId, now } from "./helpers";

export interface CreateAgentQuestionInput {
  projectId: string;
  runId: string;
  description: string;
  references?: AgentReference[];
}

export async function createAgentQuestion(
  input: CreateAgentQuestionInput,
): Promise<AgentQuestion> {
  const timestamp = now();
  const question = AgentQuestionSchema.parse({
    id: generateId(),
    projectId: input.projectId,
    runId: input.runId,
    description: input.description,
    references: input.references ?? [],
    status: "open",
    humanAnswer: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.agentQuestions.add(question);
  return question;
}

export async function getAgentQuestion(
  id: string,
): Promise<AgentQuestion | undefined> {
  return db.agentQuestions.get(id);
}

export async function listAgentQuestions(filter: {
  runId: string;
  status?: AgentQuestionStatus;
}): Promise<AgentQuestion[]> {
  const all = await db.agentQuestions.where({ runId: filter.runId }).toArray();
  const filtered = filter.status
    ? all.filter((q) => q.status === filter.status)
    : all;
  return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function answerAgentQuestion(
  id: string,
  answer: string,
): Promise<void> {
  await db.agentQuestions.update(id, {
    humanAnswer: answer,
    status: "answered",
    updatedAt: now(),
  });
}

export async function dismissAgentQuestion(id: string): Promise<void> {
  await db.agentQuestions.update(id, {
    status: "dismissed",
    updatedAt: now(),
  });
}

export async function deleteAgentQuestion(id: string): Promise<void> {
  await db.agentQuestions.delete(id);
}

export async function countAgentQuestionsSince(
  runId: string,
  sinceIso: string,
): Promise<number> {
  return db.agentQuestions
    .where({ runId })
    .filter((q) => q.createdAt > sinceIso)
    .count();
}
