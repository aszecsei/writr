import { db } from "../database";
import {
  type AgentQuestion,
  type AgentQuestionId,
  AgentQuestionSchema,
  type AgentQuestionStatus,
  type AgentReference,
  type AgentRunId,
  type ProjectId,
} from "../schemas";
import { generateId, now } from "./helpers";

export interface CreateAgentQuestionInput {
  projectId: ProjectId;
  runId: AgentRunId;
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
    proposedAnswer: null,
    proposedAt: null,
    proposedByPassNumber: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.agentQuestions.add(question);
  return question;
}

export async function getAgentQuestion(
  id: AgentQuestionId,
): Promise<AgentQuestion | undefined> {
  return db.agentQuestions.get(id);
}

export async function listAgentQuestions(filter: {
  runId: AgentRunId;
  status?: AgentQuestionStatus;
}): Promise<AgentQuestion[]> {
  const all = await db.agentQuestions.where({ runId: filter.runId }).toArray();
  const filtered = filter.status
    ? all.filter((q) => q.status === filter.status)
    : all;
  return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function answerAgentQuestion(
  id: AgentQuestionId,
  answer: string,
): Promise<void> {
  await db.agentQuestions.update(id, {
    humanAnswer: answer,
    status: "answered",
    updatedAt: now(),
  });
}

export async function dismissAgentQuestion(id: AgentQuestionId): Promise<void> {
  await db.agentQuestions.update(id, {
    status: "dismissed",
    updatedAt: now(),
  });
}

export async function deleteAgentQuestion(id: AgentQuestionId): Promise<void> {
  await db.agentQuestions.delete(id);
}

export async function countAgentQuestionsSince(
  runId: AgentRunId,
  sinceIso: string,
): Promise<number> {
  return db.agentQuestions
    .where({ runId })
    .filter((q) => q.createdAt > sinceIso)
    .count();
}

export async function countAgentQuestionsOpen(
  runId: AgentRunId,
): Promise<number> {
  return db.agentQuestions
    .where({ runId })
    .filter((q) => q.status === "open")
    .count();
}

export interface ProposeAgentQuestionAnswerInput {
  id: AgentQuestionId;
  proposedAnswer: string;
  passNumber: number;
}

/**
 * Record a proposed resolution from a self-answer reader pass. Question
 * status is left unchanged — the human still ratifies via
 * `answerAgentQuestion` (Accept) or `clearProposedAnswer` (Reject).
 */
export async function proposeAgentQuestionAnswer(
  input: ProposeAgentQuestionAnswerInput,
): Promise<void> {
  const timestamp = now();
  await db.agentQuestions.update(input.id, {
    proposedAnswer: input.proposedAnswer,
    proposedAt: timestamp,
    proposedByPassNumber: input.passNumber,
    updatedAt: timestamp,
  });
}

export async function clearProposedAnswer(id: AgentQuestionId): Promise<void> {
  await db.agentQuestions.update(id, {
    proposedAnswer: null,
    proposedAt: null,
    proposedByPassNumber: null,
    updatedAt: now(),
  });
}
