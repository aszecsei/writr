"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { AgentDefinition } from "@/db/schemas";

/**
 * List agents available for a project. Includes:
 *   - Built-in chat agents (spark, scene, reader, editor, etc.).
 *   - User-created agents that are global or scoped to this project.
 *
 * Pipeline-internal agents (orchestrator, verifier) are EXCLUDED from this
 * list — they aren't user-selectable from the chat dropdown. Use
 * `useAllAgents` (which includes them) for the Manage Agents view.
 */
export function useChatAgents(
  projectId: string | null,
): AgentDefinition[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.agents.toArray();
    return all
      .filter((a) => {
        if (a.kind === "orchestrator" || a.kind === "verifier") return false;
        if (a.kind === "user") {
          return (
            a.projectId === null ||
            (projectId !== null && a.projectId === projectId)
          );
        }
        return true;
      })
      .sort((a, b) => agentSortKey(a).localeCompare(agentSortKey(b)));
  }, [projectId]);
}

/**
 * List ALL agents (incl. orchestrator/verifier) for the Manage Agents view.
 * Built-in agents come first in canonical order, then user agents A-Z.
 */
export function useAllAgents(
  projectId: string | null,
): AgentDefinition[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.agents.toArray();
    return all
      .filter((a) => {
        if (a.kind === "user") {
          return (
            a.projectId === null ||
            (projectId !== null && a.projectId === projectId)
          );
        }
        return true;
      })
      .sort((a, b) => agentSortKey(a).localeCompare(agentSortKey(b)));
  }, [projectId]);
}

export function useAgent(id: string | null): AgentDefinition | undefined {
  return useLiveQuery(() => (id ? db.agents.get(id) : undefined), [id]);
}

const KIND_ORDER: Record<string, number> = {
  spark: 0,
  scene: 1,
  reader: 2,
  editor: 3,
  "character-dialogue": 4,
  brainstorm: 5,
  chat: 6,
  orchestrator: 7,
  verifier: 8,
  user: 99, // user-created sort by name within the trailing block
};

function agentSortKey(a: AgentDefinition): string {
  const order = KIND_ORDER[a.kind] ?? 50;
  // Pad order to 3 digits so it sorts lexicographically. Append name so
  // user-created agents sort alphabetically among themselves.
  return `${order.toString().padStart(3, "0")}-${a.name.toLocaleLowerCase()}`;
}
