"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { listAgents } from "@/db/operations/agents";
import type { AgentDefinition, ProjectId } from "@/db/schemas";
import { createEntityHook } from "../factories";

/**
 * List all agents for a project context: built-in chat agents (spark, scene,
 * reader, editor, etc.) come first in canonical order, then user-created
 * agents that are global or scoped to this project, A-Z.
 */
export function useAllAgents(
  projectId: ProjectId | null,
): AgentDefinition[] | undefined {
  return useLiveQuery(async () => {
    const agents = await listAgents(projectId);
    return agents.sort((a, b) =>
      agentSortKey(a).localeCompare(agentSortKey(b)),
    );
  }, [projectId]);
}

export const useAgent = createEntityHook(db.agents);

const KIND_ORDER: Record<string, number> = {
  spark: 0,
  scene: 1,
  reader: 2,
  editor: 3,
  "character-dialogue": 4,
  brainstorm: 5,
  chat: 6,
  "beta-reader": 7,
  "outline-architect": 8,
  worldbuilder: 9,
  "orchestrator-chat": 10,
  researcher: 11,
  "prose-writer": 12,
  user: 99, // user-created sort by name within the trailing block
};

function agentSortKey(a: AgentDefinition): string {
  const order = KIND_ORDER[a.kind] ?? 50;
  // Pad order to 3 digits so it sorts lexicographically. Append name so
  // user-created agents sort alphabetically among themselves.
  return `${order.toString().padStart(3, "0")}-${a.name.toLocaleLowerCase()}`;
}
