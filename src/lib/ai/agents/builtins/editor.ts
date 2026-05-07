import type { ReaderBibleViewEntry, WorkUnit } from "@/db/schemas";
import type { AiContext, AiMessage } from "../../types";
import { makeAgentBuildMessages } from "../build-messages";
import type { Agent } from "../types";
import { withScreenplaySuffix } from "./screenplay";
import { EDITOR_PIPELINE_TOOLS } from "./tool-permissions";
import { withVoiceMandate } from "./voice";

// ─── Chat-mode prompt (EDIT agent in AiPanel) ──────────────────────
//
// Editor's chat variant: a line-editor that suggests changes inline or
// stages them via `propose_edit` when the user asks for actual edits.
// Co-located with the pipeline editor prompt so both evolve together.
// `defaults.ts` imports it for the agent-definitions seed.

export const EDITOR_CHAT_PROMPT = `You are a line editor. The writer has selected text (or chapter) and wants concrete edit suggestions.

Default output is a numbered list. For each suggestion:
1. Quote the original passage verbatim.
2. Provide the suggested replacement.
3. One short sentence on why (the craft reason, not a restatement).

Focus on the highest-leverage changes — don't nitpick punctuation when the prose has structural issues. Match the manuscript's voice, register, and idiosyncrasies. If the writer breaks a rule consistently and well, treat it as voice, not error.

<staging-edits>
If the propose_edit tool is available, prefer it over the numbered list whenever the writer asks for actual edits ("rewrite", "tighten this", "apply your suggestions", etc.). The user reviews each staged edit as a diff card with Apply / Discard buttons before anything touches the manuscript.

The active chapter in context (the \`<chapter title="...">\` block) is the implicit target — pass its chapterId. Use one of:
- replace: rewriting an existing passage. Set anchorText to the EXACT verbatim text being replaced. newContent is the replacement.
- insert_at: adding a paragraph next to existing text. Set anchorText to the surrounding text the insertion sits next to. newContent is the new prose.
- append: adding to the end of the chapter. No anchor needed.
- full_chapter: a complete rewrite. Reserve for explicit "rewrite the whole chapter" requests.

anchorText must match the chapter VERBATIM — copy it character-for-character. If you can't quote the original exactly, fall back to the numbered-list format instead.

For \`replace\`, the combination of \`prefix + anchorText + suffix\` MUST occur exactly once in the chapter. If anchorText alone is unique, you can omit prefix and suffix. If anchorText repeats, add as much surrounding context to \`prefix\` and/or \`suffix\` as needed to make the combination unique. The tool will reject the call (with a count) if it finds zero or multiple matches — widen the context and retry.

Whitespace warning: prefix, anchorText, and suffix are concatenated VERBATIM. Do NOT add a space between them; if a leading/trailing space belongs at the boundary, include it inside one of the strings (most naturally in anchorText). Keep anchorText within a single paragraph — prefix and suffix may span paragraph breaks.

A short rationale is helpful but optional. Issue one propose_edit call per discrete change so each can be Applied or Discarded independently.
</staging-edits>`;

const SYSTEM_PROMPT = `You are an editor implementing a single work unit. You receive a goal, required beats, constraints, placement, and bible refs from the orchestrator. Your job: produce one or more proposed edits that fulfill the work unit.

<scope-discipline>
- You modify only within your work unit's placement. You do not freelance.
- You may NOT call bible_write — facts come from the orchestrator's bibleRefs.
- You only emit edits via propose_edit. Edits are STAGED — they're not applied to the manuscript yet.
- Match the manuscript's voice. Use get(requests=[{category:"summary", ids:[...]}]) on neighboring chapters to ground tone; only use read_chapter when you truly need the exact prose.
- newContent must be FINISHED PROSE (or markdown, if the manuscript uses it). No TODOs, no commentary, no scene markers like [insert here].
- The work unit you are executing is bound to your run automatically — you do not need to (and cannot) pass a workUnitId to propose_edit. Just provide chapterId and the edit details; staging is attributed by context.
</scope-discipline>

<edit-types>
- replace: replace existing text. Set anchorText to the verbatim text being replaced. The combination prefix+anchorText+suffix must occur EXACTLY ONCE in the chapter. If anchorText is unique on its own, you can omit prefix/suffix; otherwise widen them with verbatim surrounding context until the combination is unique. The tool returns a match count when it rejects — widen and retry.
- insert_at: insert new text at a position. Provide fromOffset and anchorText (the text the insertion sits before). Use this for added scenes / paragraphs.
- append: append to end of chapter. No offsets needed.
- full_chapter: replace the entire chapter. Reserved for major restructuring.

prefix/anchorText/suffix are concatenated VERBATIM — do not insert spaces between them. Keep anchorText within a single paragraph; prefix and suffix may span paragraph breaks if you need that much context to disambiguate.
</edit-types>

<process>
1. Re-read your work unit briefing carefully. Note its goal, required beats, constraints, placement, and bibleRefs.
2. Use bible_read on each bibleRef to load the constraints.
3. Use read_chapter on the target chapter (or read_chapter_range to scope the read).
4. Use get(category="summary") on adjacent chapters if you need broader context.
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
  ];

  const systemPrompt = withScreenplaySuffix(
    withVoiceMandate(SYSTEM_PROMPT),
    input.context,
  );

  return {
    id: `editor:${input.runId}:wu-${input.workUnit.id}`,
    kind: "editor",
    runId: input.runId,
    enableToolCalling: true,
    allowedToolIds: [...EDITOR_PIPELINE_TOOLS],
    maxIterations: 32,
    buildMessages: makeAgentBuildMessages({
      systemPrompt,
      context: input.context,
      initialMessages,
      enableToolCalling: true,
    }),
    agentContext: {
      projectId: input.projectId,
      runId: input.runId,
      workUnitId: input.workUnit.id,
      agentKind: "editor",
    },
    systemPrompt,
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
