"use client";

import { useParams, useRouter } from "next/navigation";
import { AgentEditorBody } from "@/components/agents/AgentEditorBody";
import type { ProjectId } from "@/db/schemas";

export default function NewAgentDefinitionPage() {
  const params = useParams<{ projectId: ProjectId }>();
  const router = useRouter();
  const projectId = params.projectId;
  const agentsHref = `/projects/${projectId}/agents`;

  return (
    <AgentEditorBody
      projectId={projectId}
      agentId={null}
      onSaved={(id) =>
        router.replace(`/projects/${projectId}/agents/definitions/${id}`)
      }
      onCancel={() => router.push(agentsHref)}
      onDeleted={() => router.push(agentsHref)}
    />
  );
}
