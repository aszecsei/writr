"use client";

import { useParams, useRouter } from "next/navigation";
import { AgentEditorBody } from "@/components/agents/AgentEditorBody";
import type { AgentDefinitionId, ProjectId } from "@/db/schemas";

export default function AgentDefinitionDetailPage() {
  const params = useParams<{
    projectId: ProjectId;
    agentId: AgentDefinitionId;
  }>();
  const router = useRouter();
  const projectId = params.projectId;
  const agentsHref = `/projects/${projectId}/agents`;

  return (
    <AgentEditorBody
      // Remount when navigating between agents so form state is reseeded.
      key={params.agentId}
      projectId={projectId}
      agentId={params.agentId}
      onSaved={() => undefined}
      onCancel={() => router.push(agentsHref)}
      onDeleted={() => router.push(agentsHref)}
    />
  );
}
