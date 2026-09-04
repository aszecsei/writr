"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { makeNestedPanelAccessor } from "@/components/ai/chat/panelAccessor";
import type { ChatMessage, ChatMessageId } from "@/components/ai/chat/types";
import type { PendingGate } from "@/components/ai/PendingGatesBar";
import { listAgents } from "@/db/operations/agents";
import type { AgentDefinition, AppSettings, ProjectId } from "@/db/schemas";
import { makeChatAgent, resolveAgentModel, runAgent } from "@/lib/ai/agents";
import type {
  ChoiceRequest,
  DelegateRequest,
  DelegationHost,
} from "@/lib/ai/tool-calling";
import type { AiContext } from "@/lib/ai/types";
import type { DistributiveOmit } from "./usePendingGates";

/**
 * Resolve a delegation target by id or case-insensitive name among the
 * available chat agents, excluding any agent already in the delegation chain
 * (`ancestry`, which includes the caller itself — preventing self-delegation
 * and cycles).
 */
function resolveDelegateTarget(
  candidates: AgentDefinition[],
  ref: string,
  ancestry: ReadonlySet<string>,
): AgentDefinition | null {
  const byId = candidates.find((a) => a.id === ref && !ancestry.has(a.id));
  if (byId) return byId;
  const lower = ref.trim().toLowerCase();
  return (
    candidates.find(
      (a) => a.name.trim().toLowerCase() === lower && !ancestry.has(a.id),
    ) ?? null
  );
}

interface BuildDelegationHostParams {
  depth: number;
  ancestry: Set<string>;
  agentName: string;
  activeProjectId: ProjectId;
  context: AiContext;
  settings: AppSettings;
  signal: AbortSignal;
}

/**
 * Delegation host: lets an orchestrator agent run named sub-agents
 * (`delegate`) and ask the user (`present_choice`). A sub-agent runs its own
 * tool loop with a nested accessor; only its final answer returns to the
 * caller. Mutation approvals and choices bubble to the gates bar via
 * `pushGate`.
 */
export function useDelegationHost({
  setMessages,
  pushGate,
}: {
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  pushGate: <T extends boolean | string>(
    gate: DistributiveOmit<PendingGate, "id">,
  ) => Promise<T>;
}) {
  const buildDelegationHost = useCallback(
    (params: BuildDelegationHostParams): DelegationHost => {
      const {
        depth,
        ancestry,
        agentName,
        activeProjectId,
        context,
        settings,
        signal,
      } = params;
      return {
        depth,
        ancestry,
        async runSubAgent(req: DelegateRequest, parentToolMessageId?: string) {
          const candidates = await listAgents(activeProjectId);
          const target = resolveDelegateTarget(candidates, req.agent, ancestry);
          if (!target) {
            return {
              answer: `No available agent named "${req.agent}".`,
              aborted: false,
            };
          }
          const subAgent = makeChatAgent({
            definition: target,
            projectId: activeProjectId,
            context,
            customSystemPrompt: settings.customSystemPrompt,
            postChatInstructions: settings.postChatInstructions,
            postChatInstructionsDepth: settings.postChatInstructionsDepth,
          });
          subAgent.agentContext.delegation = buildDelegationHost({
            depth: depth + 1,
            ancestry: new Set([...ancestry, target.id]),
            agentName: target.name,
            activeProjectId,
            context,
            settings,
            signal,
          });
          const subModel = resolveAgentModel(subAgent, settings);
          if (!subModel.apiKey) {
            return {
              answer: `No API key configured for provider '${subModel.provider}'.`,
              aborted: false,
            };
          }
          if (parentToolMessageId) {
            const parentId = parentToolMessageId as ChatMessageId;
            setMessages((prev) =>
              prev.map((m) =>
                m.role === "tool" && m.id === parentId
                  ? {
                      ...m,
                      nestedAgentName: target.name,
                      nestedMessages: m.nestedMessages ?? [],
                    }
                  : m,
              ),
            );
          }
          const nestedAccessor = makeNestedPanelAccessor({
            setMessages,
            parentToolMessageId: (parentToolMessageId ??
              crypto.randomUUID()) as ChatMessageId,
            seedPrompt: req.prompt,
            awaitToolApproval: (_id, info) =>
              pushGate<boolean>({
                kind: "approval",
                agentName: target.name,
                toolDisplayName: info?.displayName ?? "a tool",
              }),
          });
          const result = await runAgent({
            agent: subAgent,
            model: subModel,
            history: nestedAccessor,
            stream: settings.streamResponses,
            signal,
          });
          return { answer: result.content, aborted: result.aborted };
        },
        async requestChoice(req: ChoiceRequest) {
          return pushGate<string>({
            kind: "choice",
            agentName,
            question: req.question,
            options: req.options,
          });
        },
      };
    },
    [setMessages, pushGate],
  );

  return { buildDelegationHost };
}
