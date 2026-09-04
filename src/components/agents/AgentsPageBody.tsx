"use client";

import { Bot } from "lucide-react";
import Link from "next/link";
import { BUTTON_PRIMARY } from "@/components/ui/button-styles";
import type { AgentDefinition, ProjectId } from "@/db/schemas";
import { useAllAgents } from "@/hooks/data/useAgents";

function AgentRow({
  agent,
  projectId,
}: {
  agent: AgentDefinition;
  projectId: ProjectId;
}) {
  return (
    <li>
      <Link
        href={`/projects/${projectId}/agents/definitions/${agent.id}`}
        className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-density-item text-sm transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
      >
        <span className="truncate text-neutral-900 dark:text-neutral-100">
          {agent.name}
        </span>
        {agent.kind !== "user" && (
          <span className="shrink-0 text-xs uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            built-in
          </span>
        )}
      </Link>
    </li>
  );
}

function AgentSection({
  title,
  agents,
  projectId,
}: {
  title: string;
  agents: AgentDefinition[];
  projectId: ProjectId;
}) {
  if (agents.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      <ul className="mt-2 space-y-2">
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} projectId={projectId} />
        ))}
      </ul>
    </div>
  );
}

export interface AgentsPageBodyProps {
  projectId: ProjectId;
}

export function AgentsPageBody({ projectId }: AgentsPageBodyProps) {
  const agents = useAllAgents(projectId);

  const globalAgents = agents?.filter((a) => a.projectId === null) ?? [];
  const projectAgents = agents?.filter((a) => a.projectId === projectId) ?? [];

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Agents
          </h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Manage the AI personas available to this project.
          </p>
        </div>
        <Link
          href={`/projects/${projectId}/agents/definitions/new`}
          className={BUTTON_PRIMARY}
        >
          New Agent
        </Link>
      </div>

      {agents && agents.length === 0 && (
        <div className="mt-5 flex flex-col items-center gap-3 py-16 text-neutral-400 dark:text-neutral-500">
          <Bot size={40} strokeWidth={1.5} />
          <p className="text-sm">No agents yet. Add one to get started.</p>
        </div>
      )}

      <AgentSection
        title="Global"
        agents={globalAgents}
        projectId={projectId}
      />
      <AgentSection
        title="Project"
        agents={projectAgents}
        projectId={projectId}
      />
    </div>
  );
}
