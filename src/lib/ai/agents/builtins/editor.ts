import type { ReaderBibleViewEntry, WorkUnit } from "@/db/schemas";
import type { AiContext, AiMessage } from "../../types";
import { makeAgentBuildMessages } from "../build-messages";
import type { Agent } from "../types";

const EDITOR_TOOLS = [
  "bible_read",
  "read_chapter",
  "read_chapter_range",
  "read_summary",
  "propose_edit",
];

const SYSTEM_PROMPT = `You are an editor implementing a single work unit. You receive a goal, required beats, constraints, placement, and bible refs from the orchestrator. Your job: produce one or more proposed edits that fulfill the work unit.

<scope-discipline>
- You modify only within your work unit's placement. You do not freelance.
- You may NOT call bible_write — facts come from the orchestrator's bibleRefs.
- You only emit edits via propose_edit. Edits are STAGED — they're not applied to the manuscript yet.
- Match the manuscript's voice. Use read_summary on neighboring chapters to ground tone; only use read_chapter when you truly need the exact prose.
- newContent must be FINISHED PROSE (or markdown, if the manuscript uses it). No TODOs, no commentary, no scene markers like [insert here].
</scope-discipline>

<edit-types>
- replace_range: replace existing text. Provide fromOffset, toOffset, and anchorText (exact text being replaced). Use this for rewrites.
- insert_at: insert new text at a position. Provide fromOffset and anchorText (the text the insertion sits before). Use this for added scenes / paragraphs.
- append: append to end of chapter. No offsets needed.
- full_chapter: replace the entire chapter. Reserved for major restructuring.

ALWAYS include anchorText when applicable — it's used as a fallback locator if offsets drift.
</edit-types>

<process>
1. Re-read your work unit briefing carefully. Note its goal, required beats, constraints, placement, and bibleRefs.
2. Use bible_read on each bibleRef to load the constraints.
3. Use read_chapter on the target chapter (or read_chapter_range to scope the read).
4. Use read_summary on adjacent chapters if you need broader context.
5. Draft and call propose_edit. You may call propose_edit multiple times if the work unit naturally splits into multiple staged edits.
6. After all edits are staged, produce a brief 1-2 sentence summary of what you did and stop.

Do NOT plan further work. Do NOT propose edits outside your work unit's placement. Stay in scope.`;

export interface MakeEditorAgentInput {
  runId: string;
  projectId: string;
  workUnit: WorkUnit;
  /** Pre-loaded bible refs (path -> value). Inlined into the briefing so the
   * editor doesn't have to round-trip through bible_read for every constraint. */
  bibleRefs: ReaderBibleViewEntry[];
  /** Cached chapter title for nicer briefing text. */
  chapterTitle: string;
  context: AiContext;
}

export function makeEditorAgent(input: MakeEditorAgentInput): Agent {
  const initialMessages: AiMessage[] = [
    {
      role: "user",
      content: buildEditorBriefing(input),
    },
    {
      role: "assistant",
      content:
        "Understood. I'll re-check the placement and constraints, read the relevant chapter, then propose the edit(s).",
    },
  ];

  return {
    id: `editor:${input.runId}:wu-${input.workUnit.id}`,
    kind: "editor",
    runId: input.runId,
    enableToolCalling: true,
    allowedToolIds: EDITOR_TOOLS,
    maxIterations: 32,
    buildMessages: makeAgentBuildMessages({
      systemPrompt: SYSTEM_PROMPT,
      context: input.context,
      initialMessages,
      enableToolCalling: true,
    }),
    agentContext: {
      projectId: input.projectId,
      runId: input.runId,
      agentKind: "editor",
    },
    systemPrompt: SYSTEM_PROMPT,
  };
}

function buildEditorBriefing(input: MakeEditorAgentInput): string {
  const wu = input.workUnit;
  const lines = [
    "<work-unit>",
    `<id>${wu.id}</id>`,
    `<tier>${wu.tier}</tier>`,
    `<goal>${wu.goal}</goal>`,
  ];
  if (wu.requiredBeats.length > 0) {
    lines.push("<required-beats>");
    wu.requiredBeats.forEach((b, i) => {
      lines.push(`  ${i + 1}. ${b}`);
    });
    lines.push("</required-beats>");
  }
  if (wu.constraints.length > 0) {
    lines.push("<constraints>");
    for (const c of wu.constraints) lines.push(`  - ${c}`);
    lines.push("</constraints>");
  }
  lines.push(
    `<placement chapterId="${wu.placement.chapterId}" chapterTitle="${escapeAttr(input.chapterTitle)}" position="${wu.placement.position}">`,
  );
  if (wu.placement.anchorText) {
    lines.push(`  <anchor-text>${wu.placement.anchorText}</anchor-text>`);
  }
  if (wu.placement.paragraphIndex !== undefined) {
    lines.push(
      `  <paragraph-index>${wu.placement.paragraphIndex}</paragraph-index>`,
    );
  }
  if (wu.placement.pov) {
    lines.push(`  <pov>${wu.placement.pov}</pov>`);
  }
  lines.push("</placement>");
  if (wu.targetLengthWords) {
    lines.push(
      `<target-length-words>${wu.targetLengthWords}</target-length-words>`,
    );
  }
  lines.push("</work-unit>");

  if (input.bibleRefs.length > 0) {
    lines.push("<bible-refs>");
    for (const ref of input.bibleRefs) {
      lines.push(`<entry path="${ref.path}">`);
      lines.push(JSON.stringify(ref.value, null, 2));
      lines.push("</entry>");
    }
    lines.push("</bible-refs>");
  }

  lines.push(
    "Begin by reading the target chapter (or a relevant range), then propose the edit(s).",
  );
  return lines.join("\n");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
