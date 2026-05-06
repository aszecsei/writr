import type { AgentNote, AgentQuestion } from "@/db/schemas";
import type { AiContext, AiMessage } from "../../types";
import { makeAgentBuildMessages } from "../build-messages";
import type { Agent } from "../types";
import { withScreenplaySuffix } from "./screenplay";
import { ORCHESTRATOR_TOOLS } from "./tool-permissions";
import { withVoiceMandate } from "./voice";

const SYSTEM_PROMPT = `You are an editorial orchestrator. The reader has produced notes and questions about the manuscript. Your job is to convert open notes into a tiered edit plan composed of "work units."

<work-unit-discipline>
A work unit is a single coherent editorial task with one owner. Examples:
  - Add a 600-word foreshadowing scene at the end of chapter 3 establishing X
  - Rewrite the opening 3 paragraphs of chapter 7 to fix POV slippage
  - Cut 2 redundant flashback paragraphs in chapter 12

Each work unit must specify:
  - goal — what this edit accomplishes
  - requiredBeats — what must happen / be established (concrete beats, not vague intentions)
  - constraints — what it must NOT contradict (with bible refs)
  - placement — chapter, position, optional anchorText / paragraph index / POV
  - targetLengthWords — approximate word count
  - bibleRefs — which reader-bible paths the editor should consult
  - sourceNoteIds — which open notes this addresses
  - dependencies — other work-unit ids that must apply first

Anti-pattern: NEVER write actual prose or dialogue in the goal/beats. That belongs to the editor agent with full context.

Multi-chapter work units (e.g. seed foreshadowing across chapters 4/9/12) must be ONE unit owned by ONE editor — never split.
</work-unit-discipline>

<tiering>
Group work units into tiers. Tier numbers 1+ (1 = first to execute):
  1. Structural — scene additions, cuts, reorderings
  2. Multi-chapter threading — foreshadowing seeds, arc adjustments
  3. Single-chapter substantive — rewriting a scene's beats
  4. Local — continuity fixes, small insertions

Within a tier, two work units must NOT touch overlapping ranges of the same chapter. If they conflict, either merge them or push one to a later tier (or use 'dependencies' to serialize them).

The user is going to plan one tier at a time. Focus on the CURRENT tier you are asked to plan.
</tiering>

<process>
1. Use list_notes(status="open") and list_questions(status="open") to see what needs addressing.
2. Use bible_read / bible_list / get(category="summary") to understand context. Avoid read_chapter unless absolutely necessary.
3. For each cluster of related notes, call create_work_unit. Build up the tier.
4. When you've covered the notes in scope for this tier, call finalize_tier with the ordered list of work-unit ids.
5. After finalize_tier, produce a brief 2-4 sentence summary of the tier and stop.
</process>

You may NOT propose edits or write prose. Only create work units and finalize the tier.`;

export interface MakeOrchestratorAgentInput {
  runId: string;
  projectId: string;
  /** Tier the orchestrator should plan. */
  tier: number;
  /** Open notes available for grouping into work units. */
  openNotes: AgentNote[];
  openQuestions: AgentQuestion[];
  /** Optional briefing from the human (e.g. "focus on chapter 5–8"). */
  humanBriefing?: string;
  context: AiContext;
}

export function makeOrchestratorAgent(
  input: MakeOrchestratorAgentInput,
): Agent {
  const initialMessages: AiMessage[] = [
    {
      role: "user",
      content: buildOrchestratorBriefing(input),
    },
  ];

  const systemPrompt = withScreenplaySuffix(
    withVoiceMandate(SYSTEM_PROMPT),
    input.context,
  );

  return {
    id: `orchestrator:${input.runId}:tier-${input.tier}`,
    kind: "orchestrator",
    runId: input.runId,
    enableToolCalling: true,
    allowedToolIds: [...ORCHESTRATOR_TOOLS],
    maxIterations: 64,
    buildMessages: makeAgentBuildMessages({
      systemPrompt,
      context: input.context,
      initialMessages,
      enableToolCalling: true,
    }),
    agentContext: {
      projectId: input.projectId,
      runId: input.runId,
      agentKind: "orchestrator",
    },
    systemPrompt,
  };
}

function buildOrchestratorBriefing(input: MakeOrchestratorAgentInput): string {
  const lines = [
    `<plan-tier number="${input.tier}">`,
    `You are planning tier ${input.tier}. There are ${input.openNotes.length} open notes and ${input.openQuestions.length} open questions in this run.`,
  ];

  if (input.openQuestions.length > 0) {
    lines.push(
      "<answered-questions>",
      "Note: questions surface to the human, NOT to you. Don't try to answer them — they may be intentionally unresolved.",
      "</answered-questions>",
    );
  }

  if (input.humanBriefing) {
    lines.push("<human-briefing>", input.humanBriefing, "</human-briefing>");
  }

  lines.push("</plan-tier>");
  lines.push(
    'Begin by calling list_notes(status="open") to see what\'s outstanding.',
  );
  return lines.join("\n");
}
