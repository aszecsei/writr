import type { ProposedEdit, WorkUnit } from "@/db/schemas";
import type { AiContext, AiMessage } from "../../types";
import { makeAgentBuildMessages } from "../build-messages";
import type { Agent } from "../types";

const VERIFIER_TOOLS = [
  "bible_read",
  "bible_list",
  "read_chapter",
  "read_chapter_range",
  "read_summary",
  "report_verification",
];

const SYSTEM_PROMPT = `You are a constrained re-reader verifying that the latest tier of edits accomplished what they intended without breaking continuity. You run AFTER edits have been applied.

<scope-discipline>
You do NOT propose fixes. Your only job is to OBSERVE and REPORT.
For every work unit in the tier, call report_verification(workUnitId=...) once. Then call report_verification once more without workUnitId for tier-wide drift.
</scope-discipline>

<what-to-check>
Per work unit:
  - goalAchieved: did the edit accomplish the stated goal? Read the affected chapter and judge.
  - contradictions: does the new content contradict any reader-bible facts? Use bible_read on relevant paths.
  - continuityBreaks: does the edit break continuity with adjacent chapters (e.g. references a scene that no longer fits)?
  - voiceMismatches: does the new prose match the manuscript's voice? Compare against the voice/ paths in the bible.

Tier-wide (workUnitId omitted):
  - Look at the chapter set as a whole. Are there reader-knowledge inconsistencies? Has any character behavior become unreadable across the tier?
  - This pass catches issues no single work-unit verification would notice.
</what-to-check>

<output-format>
Findings are JSON-encoded arrays of {description, references?}. Examples:
  contradictions=[{"description":"Says Kira has a sister but bible says only child","references":[{"kind":"bible","id":"characters/Kira"}]}]
  continuityBreaks=[{"description":"Chapter 7's new scene references the locket, but locket isn't introduced until chapter 9"}]
  voiceMismatches=[{"description":"New paragraph uses contractions, manuscript voice is formal"}]

Pass empty arrays for categories with no findings. goalAchieved is required for per-work-unit calls; omit it (or pass true) for tier-wide.
</output-format>

<process>
1. For each work unit listed in the briefing: bible_read its constraints, read the affected chapter, judge, call report_verification with workUnitId.
2. After all per-work-unit verifications: do a tier-wide drift pass. Sample read_summary across the tier's chapter set; call report_verification once more without workUnitId.
3. Produce a brief 1-2 sentence summary and stop.
</process>

You may NOT propose fixes, edit prose, or call propose_edit. Findings will be routed back as new notes for the next planning round automatically.`;

export interface VerifierWorkUnitContext {
  unit: WorkUnit;
  /** The proposed-edit ids that were applied for this unit. Used to give the
   * verifier focused chapter offsets to inspect. */
  appliedEdits: ProposedEdit[];
}

export interface MakeVerifierAgentInput {
  runId: string;
  projectId: string;
  tier: number;
  workUnits: VerifierWorkUnitContext[];
  /** Chapter ids touched by the tier (for the drift sweep). */
  affectedChapterIds: string[];
  context: AiContext;
}

export function makeVerifierAgent(input: MakeVerifierAgentInput): Agent {
  const initialMessages: AiMessage[] = [
    {
      role: "user",
      content: buildVerifierBriefing(input),
    },
    {
      role: "assistant",
      content:
        "Understood. I'll verify each work unit, then run a tier-wide drift sweep.",
    },
  ];

  return {
    id: `verifier:${input.runId}:tier-${input.tier}`,
    kind: "verifier",
    runId: input.runId,
    enableToolCalling: true,
    allowedToolIds: VERIFIER_TOOLS,
    maxIterations: 64,
    buildMessages: makeAgentBuildMessages({
      systemPrompt: SYSTEM_PROMPT,
      context: input.context,
      initialMessages,
      enableToolCalling: true,
    }),
    agentContext: {
      projectId: input.projectId,
      runId: input.runId,
      agentKind: "verifier",
    },
    systemPrompt: SYSTEM_PROMPT,
  };
}

function buildVerifierBriefing(input: MakeVerifierAgentInput): string {
  const lines = [
    `<verify-tier number="${input.tier}">`,
    `Tier ${input.tier} has just been applied to the manuscript. Verify each work unit's outcome and then perform a tier-wide drift check.`,
    "<work-units>",
  ];
  for (const ctx of input.workUnits) {
    const wu = ctx.unit;
    lines.push(`<work-unit id="${wu.id}">`);
    lines.push(`  <goal>${wu.goal}</goal>`);
    lines.push(`  <chapter-id>${wu.placement.chapterId}</chapter-id>`);
    if (wu.requiredBeats.length > 0) {
      lines.push("  <required-beats>");
      wu.requiredBeats.forEach((b, i) => {
        lines.push(`    ${i + 1}. ${b}`);
      });
      lines.push("  </required-beats>");
    }
    if (wu.constraints.length > 0) {
      lines.push("  <constraints>");
      for (const c of wu.constraints) lines.push(`    - ${c}`);
      lines.push("  </constraints>");
    }
    if (wu.bibleRefs.length > 0) {
      lines.push(`  <bible-refs>${wu.bibleRefs.join(", ")}</bible-refs>`);
    }
    if (ctx.appliedEdits.length > 0) {
      lines.push(
        `  <applied-edits>${ctx.appliedEdits.length} edit(s) applied</applied-edits>`,
      );
    }
    lines.push("</work-unit>");
  }
  lines.push("</work-units>");
  if (input.affectedChapterIds.length > 0) {
    lines.push(
      `<affected-chapters>${input.affectedChapterIds.join(", ")}</affected-chapters>`,
    );
  }
  lines.push("</verify-tier>");
  lines.push(
    "Begin with the first work unit. Use bible_read for constraints and read_chapter / read_chapter_range to inspect post-edit content.",
  );
  return lines.join("\n");
}
