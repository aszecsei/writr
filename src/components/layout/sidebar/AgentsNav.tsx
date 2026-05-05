"use client";

import Link from "next/link";
import { useAgentRunsByProject } from "@/hooks/data/useAgentRun";

interface AgentsNavProps {
  projectId: string;
  pathname: string;
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  reading: "Reading",
  planning: "Planning",
  "awaiting-plan-approval": "Awaiting Plan",
  "executing-tier": "Executing",
  "awaiting-edit-approval": "Awaiting Edits",
  "applying-tier": "Applying",
  "verifying-tier": "Verifying",
  complete: "Complete",
  cancelled: "Cancelled",
  error: "Error",
};

export function AgentsNav({ projectId, pathname }: AgentsNavProps) {
  const runs = useAgentRunsByProject(projectId);
  const indexHref = `/projects/${projectId}/agents`;

  return (
    <div className="space-y-2">
      <Link
        href={indexHref}
        className={`block rounded-md px-3 py-density-item text-sm transition-colors ${
          pathname === indexHref
            ? "bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-200"
            : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
        }`}
      >
        All Runs
      </Link>

      {runs && runs.length > 0 && (
        <>
          <h4 className="mt-3 px-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Recent
          </h4>
          <ul className="space-y-1">
            {runs.slice(0, 8).map((run) => {
              const href = `/projects/${projectId}/agents/${run.id}`;
              const isActive = pathname === href;
              return (
                <li key={run.id}>
                  <Link
                    href={href}
                    className={`block rounded-md px-3 py-density-item text-sm transition-colors ${
                      isActive
                        ? "bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-200"
                        : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
                    }`}
                  >
                    <div className="truncate font-medium">{run.name}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {STATUS_LABEL[run.status] ?? run.status}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
