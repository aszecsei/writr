"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type {
  AgentNote,
  AgentNoteStatus,
  AgentQuestion,
  AgentQuestionStatus,
} from "@/db/schemas";

export function useAgentNotes(
  runId: string | null,
  status?: AgentNoteStatus,
): AgentNote[] | undefined {
  return useLiveQuery(async () => {
    if (!runId) return [];
    const all = await db.agentNotes.where({ runId }).toArray();
    const filtered = status ? all.filter((n) => n.status === status) : all;
    return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [runId, status]);
}

export function useAgentQuestions(
  runId: string | null,
  status?: AgentQuestionStatus,
): AgentQuestion[] | undefined {
  return useLiveQuery(async () => {
    if (!runId) return [];
    const all = await db.agentQuestions.where({ runId }).toArray();
    const filtered = status ? all.filter((q) => q.status === status) : all;
    return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [runId, status]);
}
