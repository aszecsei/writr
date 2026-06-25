"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AgentDefinition, ProjectId } from "@/db/schemas";
import { useAllAgents } from "@/hooks/data/useAgents";

interface AgentsNavProps {
  projectId: ProjectId;
  pathname: string;
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="mt-3 px-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
      {children}
    </h4>
  );
}

interface AgentDefRowProps {
  agent: AgentDefinition;
  projectId: ProjectId;
  pathname: string;
}

function AgentDefRow({ agent, projectId, pathname }: AgentDefRowProps) {
  const href = `/projects/${projectId}/agents/definitions/${agent.id}`;
  const isActive = pathname === href;
  const tag = agent.kind !== "user" ? "built-in" : null;

  return (
    <li>
      <Link
        href={href}
        className={`flex items-center justify-between gap-2 rounded-md px-3 py-density-item text-sm transition-colors ${
          isActive
            ? "bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-200"
            : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
        }`}
      >
        <span className="truncate">{agent.name}</span>
        {tag && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {tag}
          </span>
        )}
      </Link>
    </li>
  );
}

export function AgentsNav({ projectId, pathname }: AgentsNavProps) {
  const agents = useAllAgents(projectId);
  const newHref = `/projects/${projectId}/agents/definitions/new`;

  // Global = built-ins + global user agents; Project = project-scoped user
  // agents. Built-ins are always global (projectId === null).
  const globalAgents = agents?.filter((a) => a.projectId === null) ?? [];
  const projectAgents = agents?.filter((a) => a.projectId === projectId) ?? [];

  return (
    <div className="space-y-2">
      <Link
        href={newHref}
        className={`flex items-center gap-1.5 rounded-md px-3 py-density-item text-sm font-medium transition-colors ${
          pathname === newHref
            ? "bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-200"
            : "text-primary-600 hover:bg-neutral-100 dark:text-primary-400 dark:hover:bg-neutral-900"
        }`}
      >
        <Plus size={14} />
        New Agent
      </Link>

      {globalAgents.length > 0 && (
        <>
          <SectionHeading>Global</SectionHeading>
          <ul className="space-y-1">
            {globalAgents.map((a) => (
              <AgentDefRow
                key={a.id}
                agent={a}
                projectId={projectId}
                pathname={pathname}
              />
            ))}
          </ul>
        </>
      )}

      {projectAgents.length > 0 && (
        <>
          <SectionHeading>Project</SectionHeading>
          <ul className="space-y-1">
            {projectAgents.map((a) => (
              <AgentDefRow
                key={a.id}
                agent={a}
                projectId={projectId}
                pathname={pathname}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
