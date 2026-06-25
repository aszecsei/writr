import { z } from "zod";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

/**
 * Maximum delegation nesting depth. The top-level orchestrator is depth 0, so
 * a cap of 2 allows orchestrator → sub-agent → sub-sub-agent and no further.
 * Keeps runaway recursion (and token cost) bounded even with the cycle guard.
 */
export const DELEGATE_MAX_DEPTH = 2;

export const delegateTool = defineTool({
  id: "delegate",
  name: "Delegate to Sub-agent",
  description:
    "Delegate a self-contained subtask to another agent by name. The sub-agent " +
    "runs its own tool loop autonomously and returns ONLY its final answer — " +
    "its intermediate research and reasoning never enter your context, which " +
    "keeps your working memory focused. Write the `prompt` as a complete, " +
    "standalone briefing: the sub-agent does not see this conversation. Use it " +
    "to fan out verbose or specialized work (deep manuscript reads, bible " +
    "audits, focused rewrites) to the agent best suited for it.",
  parameters: {
    type: "object",
    properties: {
      agent: {
        type: "string",
        description:
          "Name (or id) of the sub-agent to run. Must be a different agent " +
          "than yourself.",
      },
      prompt: {
        type: "string",
        description:
          "The subtask, fully specified and self-contained. The sub-agent " +
          "receives this as its only instruction and cannot see the current " +
          "conversation.",
      },
    },
    required: ["agent", "prompt"],
  },
  inputSchema: z.object({
    agent: z.string().min(1),
    prompt: z.string().min(1),
  }),
  // The sub-agent's own mutating tools gate individually; delegation itself is
  // not a mutation and needs no separate approval.
  requiresApproval: false,
  async execute(params, context) {
    const host = context.delegation;
    if (!host) {
      return fail(
        "Delegation is only available in interactive chat, not pipeline runs.",
      );
    }
    if (host.depth >= DELEGATE_MAX_DEPTH) {
      return fail(
        `Delegation nesting limit (${DELEGATE_MAX_DEPTH}) reached — cannot delegate further from here.`,
      );
    }
    const outcome = await host.runSubAgent(
      { agent: params.agent, prompt: params.prompt },
      context.toolMessageId,
    );
    if (outcome.aborted) {
      return fail(`Sub-agent "${params.agent}" run was cancelled.`);
    }
    return ok(`Sub-agent "${params.agent}" result:\n\n${outcome.answer}`, {
      agent: params.agent,
      answer: outcome.answer,
    });
  },
});
