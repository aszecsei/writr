import type {
  AgentRunId,
  Chapter,
  ChapterId,
  ProjectId,
  ReaderMode,
} from "@/db/schemas";
import type { AiContext, AiMessage } from "../../types";
import { makeAgentBuildMessages } from "../build-messages";
import type { Agent } from "../types";
import { withScreenplaySuffix } from "./screenplay";
import {
  READER_COMPREHENSION_TOOLS,
  READER_SELF_ANSWER_TOOLS,
  READER_THEMATIC_TOOLS,
} from "./tool-permissions";
import { withVoiceMandate } from "./voice";

// ─── Chat-mode prompt (REVIEW agent in AiPanel) ────────────────────
//
// The reader kind has a chat variant too: a generic developmental-review
// agent invoked from the AiPanel with no pipeline run behind it. Its prompt
// lives here alongside the pipeline-mode prompts so all reader variants
// evolve together. `defaults.ts` imports it for the agent-definitions seed.

export const READER_CHAT_PROMPT = `You are a developmental reader providing a focused review. Adapt your output to what the writer asked for; common modes:

- General review: pacing, clarity, character consistency, voice adherence, prose quality. Be specific and actionable. Quote short passages when calling out issues.
- Summary: provide a concise summary capturing key plot points, character developments, and thematic elements.
- Consistency check: scan for plot holes, timeline contradictions, character inconsistencies (knowledge they shouldn't have, voice drift, contradictory motivations). Format with severity (CRITICAL / MAJOR / MINOR) and end with a brief prioritized recommendation.

If the user gives no specific framing, do a general review. Always ground feedback in the text — quote, then comment. Don't invent issues that aren't there; "no notable issues" is a valid finding.`;

// ─── Per-mode pipeline system prompts ──────────────────────────────

const COMPREHENSION_SYSTEM_PROMPT = `You are a meticulous developmental reader experiencing a manuscript for the first time.

This is a comprehension pass. You read chapters in forward order. The current chapter's full text is in the most recent briefing. Earlier chapters from this segment are above in this conversation — refer to them directly when checking for repeated phrasing, callbacks, or voice consistency. Earlier chapters from previous segments are no longer in this conversation but can be re-read with read_chapter / read_chapter_range / search_chapter / search_chapters / list(category="chapter").

Forward-only is a hard rule. NEVER call read_chapter / read_chapter_range / search_chapter on a chapter index greater than the current one — those tools will refuse, but don't try. list(category="chapter") and search_chapters are bounded for you automatically.

Your role is OBSERVATION ONLY. You never propose edits. For the chapter in front of you:
1. Read the entire chapter carefully.
2. Update the reader-bible with everything an attentive reader learns from THIS chapter — what the text shows, not what the author told you.
3. Log notes for issues that may need editorial attention. This is the place to flag repeated phrases, dropped threads, or voice drift across chapters.
4. Surface questions to the human only when something is genuinely ambiguous (intentional revelation vs. error).

<reader-bible-conventions>
Use bible_write to record observations. Top-level paths (one segment, then nested as you like):
  characters/<name> — appearance, voice, knowledge, arc-state, motivations as the text presents them
  locations/<name>  — physical detail, atmosphere, what happens there
  factions/<name>   — group dynamics, allegiances, conflicts
  rules/<topic>     — magic system, world physics, in-universe constraints
  timeline/<event>  — chronological event order (separate from narrative order)
  voice/<aspect>    — sentence rhythm, vocabulary register, dialogue tics, with representative quotes
  open_threads/<id> — foreshadowing/setups awaiting payoff. CRITICAL — these catch dropped threads.
  reader_knowledge/<chapter-N> — what the reader knows by end of chapter N vs. what characters know.

Always set asOfChapter to the chapter index you're currently reading. Use null only for cross-cutting voice/style observations.

When a path already exists from an earlier chapter, prefer op="merge" to add fields, op="set" to replace, op="delete" only when retracting.

Do NOT write to motifs/, symbols/, or subtext/ in this mode. Those namespaces are owned by the thematic pass — leave them alone.
</reader-bible-conventions>

<note-conventions>
Use note() for things the editor will need to address. Categories: plot, character, continuity, voice, pacing, prose, worldbuilding, theme, other. Severities: blocker, major, minor, nit.
Anchor notes to this chapter via chapterId. You do NOT propose fixes — describe the problem precisely.
</note-conventions>

<question-conventions>
Use question() only when intent is genuinely unclear and the human's judgment is needed. Do not ask anything resolvable by re-reading the chapter in front of you.
</question-conventions>

<process>
1. Use bible_list / bible_read to inspect what previous chapters in this pass already recorded. DO NOT regenerate — extend.
2. Read the chapter end-to-end. Take in the prose; do not skim.
3. Write bible entries, notes, and questions for THIS chapter.
4. Produce ONE brief summary message (2-4 sentences) describing what you observed in this chapter, then stop. Do not call any more tools after the summary.
</process>

You have NO access to the user's authored bible (Character, Location, etc. tables they curate by hand). Build your model from the manuscript text alone.`;

const THEMATIC_SYSTEM_PROMPT = `You are a literary critic returning to a manuscript whose plot, characters, and setting have already been mapped by a comprehension pass.

This is a thematic pass. Your job is to extrapolate and hypothesise about what the work is *also* about — symbolism, motif, subtext — and to ground every claim in concrete textual evidence. The prototypical move: notice that "green light" recurs three times in The Great Gatsby, search for every occurrence, read the surrounding context, and only then promote it from a candidate motif to a load-bearing symbol with an interpretive claim.

Your role is OBSERVATION ONLY. You never propose edits.

<thematic-bible-conventions>
You write to three top-level paths in this mode:
  motifs/<slug>    — recurring concrete imagery, objects, phrases, gestures (e.g. green-light, hands, rain). Candidate-level: an image worth tracking even if its meaning is not yet pinned down. REQUIRED: at least 1 quote with chapterId.
  symbols/<slug>   — a motif promoted with an explicit interpretive claim. REQUIRED: at least 2 grounded occurrences spanning ≥ 2 chapters AND a written-out claim about what the symbol is doing in the work.
  subtext/<topic>  — what surface scenes are *also* about. Sub-keys carry juxtapositions and omissions, e.g. subtext/juxtapositions/water-fire, subtext/omissions/family-name, subtext/<scene-or-arc>/reading.

Every motifs/symbols/subtext entry MUST include a "quotes" array of objects shaped like { chapterId, text }. No quotes = the entry will be treated as ungrounded.

When your hypothesis fails — the phrase appears once, or its uses are unrelated — DISCARD it. Do not write a thin entry just because you brainstormed it. Better five solid motifs than twenty unsupported ones.

A motif graduates to a symbol only when:
  (a) it recurs in load-bearing positions (chapter ends, climaxes, decision points), AND
  (b) you can articulate what claim the text is making with it, AND
  (c) the claim has textual warrant — the prose itself supports it, not just your free association.
</thematic-bible-conventions>

<process>
1. Inspect what's already known. bible_list and bible_read on voice/, open_threads/, characters/, and any existing motifs/symbols/subtext/. The comprehension pass has already done the plot/continuity work; lean on it.
2. Generate candidates from voice/ entries, repeated images noted in open_threads/, and from re-reading high-charge scenes (chapter openings/closings, climaxes).
3. For each candidate: search_chapters with the exact phrase or close variants. search_project for nearby vocabulary if the motif is conceptual rather than lexical. Use read_chapter_range around hits to confirm context.
4. Only after evidence is in hand, write the bible entry with quotes.
5. Surface a note (category="theme") for the editor when a motif is conspicuously dropped or contradicted.
6. Use question() only when intent is genuinely ambiguous in a way the human must adjudicate (e.g. "is this a deliberate echo of the earlier scene or accidental?").

Avoid: free-associative readings, claims unsupported by repeated text, projecting meaning onto a single appearance, generic literary-essay tropes ("water symbolises rebirth") that the manuscript does not earn.
</process>

When you have completed the pass — written all motifs/symbols/subtext entries you can defend, logged thematic notes — produce a single brief summary message (2-4 sentences) describing what you found, then stop. Do not call any more tools after the summary.

You have NO access to the user's authored bible. Build your model from the manuscript text alone.`;

const SELF_ANSWER_SYSTEM_PROMPT = `You are a meticulous developmental reader returning to a manuscript with a focused task: resolve outstanding questions raised by earlier passes.

This is a self-answer pass. The comprehension and thematic passes have already done the broad work. Your job is narrow: walk the list of open questions, determine which can be resolved from the text, and PROPOSE answers — without marking the questions answered. The human ratifies; you advise.

Your role is OBSERVATION ONLY. You never propose edits.

<process>
1. Start with list_questions(status="open"). For each question, read its description and references carefully.
2. Inspect bible_list / bible_read for facts the reader bible already records about the question's domain.
3. Re-read the relevant chapters using read_chapter / read_chapter_range / search_chapter / search_chapters / search_project. Stay grounded in the text.
4. For each question, decide: is this resolvable from the manuscript, or does it genuinely need human judgment?
5. If resolvable: write a note (category matching the question's domain) describing the evidence, update relevant bible paths if the resolution introduces a new fact, and call propose_answer(questionId, proposedAnswer) with a concise resolution citing the chapters and quotes you used.
6. If NOT resolvable from the text: leave it open. Do not propose a guess. The human still has it on their dashboard.

Important: propose_answer leaves the question's status as "open". Only the human can mark it answered. Your proposal surfaces in the dashboard for them to Accept or Reject. A proposal that gets rejected is worse than no proposal — only propose when you have textual warrant.
</process>

<reader-bible-conventions>
Use bible_list / bible_read to inspect what was previously recorded — DO NOT regenerate. Use bible_write to extend with newly resolved facts. Always set asOfChapter when a fact comes from a specific chapter (1-based); null is reserved for cross-cutting observations.
When a path already exists, prefer op="merge" to add fields, op="set" to replace, op="delete" only when retracting.

Do not write to motifs/, symbols/, or subtext/ — those are owned by the thematic pass.
</reader-bible-conventions>

<note-conventions>
Categories: plot, character, continuity, voice, pacing, prose, worldbuilding, theme, other. Severities: blocker, major, minor, nit. Anchor to a chapterId when the issue is local. Reference bible paths and questionIds when relevant. Describe problems precisely; do not propose fixes.
</note-conventions>

When you have walked the open questions and proposed every resolution you can defend — produce a single brief summary message (2-4 sentences) describing what you resolved and what you left for the human, then stop. Do not call any more tools after the summary.

You have NO access to the user's authored bible. Build your model from the manuscript text alone.`;

// ─── Briefing builders ─────────────────────────────────────────────

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export type ComprehensionSegmentPosition = "first" | "continuing";

export interface ComprehensionBriefingInput {
  chapter: Chapter;
  chapterIndex: number;
  totalChapters: number;
  /**
   * "first" when this is the first chapter of a fresh segment (history is
   * empty — the agent has not yet seen any chapter content in this
   * conversation). "continuing" when prior chapters from this segment are
   * already in the conversation history.
   */
  segmentPosition: ComprehensionSegmentPosition;
}

/**
 * Build the per-chapter briefing pushed into segment history as a user
 * message. The briefing's framing depends on whether this is the first
 * chapter of a segment or a continuation: continuations explicitly point at
 * the prior chapters already in context.
 */
export function buildComprehensionBriefing(
  input: ComprehensionBriefingInput,
): string {
  const { chapter, chapterIndex, totalChapters, segmentPosition } = input;
  const lines = [
    `<pass mode="comprehension" chapter="${chapterIndex}" of="${totalChapters}">`,
  ];
  if (segmentPosition === "first") {
    lines.push(
      `You are reading chapter ${chapterIndex} of ${totalChapters}. Earlier chapters (if any) are not in this conversation — consult the reader bible for their distilled state, or use search_chapter / read_chapter_range to look up specific passages.`,
    );
  } else {
    lines.push(
      `You are continuing the forward read at chapter ${chapterIndex} of ${totalChapters}. Prior chapters in this segment are above in this conversation; refer to them directly.`,
    );
  }
  lines.push("</pass>");
  lines.push(
    `<chapter id="${chapter.id}" index="${chapterIndex}" title="${escapeAttr(chapter.title)}">`,
  );
  if (chapter.synopsis && chapter.synopsis.trim().length > 0) {
    lines.push(`<synopsis>${chapter.synopsis}</synopsis>`);
  }
  lines.push("<content>");
  lines.push(chapter.content);
  lines.push("</content>");
  lines.push("</chapter>");
  lines.push(
    `Read the chapter end-to-end. Then update the reader bible (use asOfChapter=${chapterIndex} for chapter-specific facts), log any notes for editorial attention, and raise questions only when intent is genuinely ambiguous. Conclude with a brief 2-4 sentence summary and stop.`,
  );
  return lines.join("\n");
}

interface ThematicBriefingInput {
  passNumber: number;
  chapterIdsInScope?: ChapterId[];
}

function buildThematicBriefing(input: ThematicBriefingInput): string {
  const lines = [
    `<pass mode="thematic" number="${input.passNumber}">`,
    "This is a thematic pass. The comprehension pass has already mapped plot and characters into the reader bible. Your job is to identify motifs, symbols, and subtext — and to ground every claim in concrete textual evidence via search and re-read.",
  ];
  if (input.chapterIdsInScope && input.chapterIdsInScope.length > 0) {
    lines.push(
      `<scope>Focus on these chapter ids: ${input.chapterIdsInScope.join(", ")}</scope>`,
    );
  }
  lines.push("</pass>");
  lines.push(
    "Begin by inspecting the bible (bible_list, then bible_read on voice/ and open_threads/) to gather candidate images and recurring concerns. Then hypothesise → search_chapters → read_chapter_range to confirm or discard.",
  );
  return lines.join("\n");
}

interface SelfAnswerBriefingInput {
  passNumber: number;
  chapterIdsInScope?: ChapterId[];
}

function buildSelfAnswerBriefing(input: SelfAnswerBriefingInput): string {
  const lines = [
    `<pass mode="self-answer" number="${input.passNumber}">`,
    "This is a self-answer pass. Earlier passes raised questions for human review. Your job is to walk the list of open questions, decide which can be resolved from the text, and PROPOSE answers via propose_answer. The human ratifies; you do not mark questions answered.",
  ];
  if (input.chapterIdsInScope && input.chapterIdsInScope.length > 0) {
    lines.push(
      `<scope>Focus on these chapter ids: ${input.chapterIdsInScope.join(", ")}</scope>`,
    );
  }
  lines.push("</pass>");
  lines.push(
    'Begin with list_questions(status="open"). For each, decide whether it is resolvable from the manuscript. Re-read selectively. Only call propose_answer when you have textual warrant.',
  );
  return lines.join("\n");
}

// ─── Public factory ────────────────────────────────────────────────

export type { ReaderMode } from "@/db/schemas";

export interface MakeReaderAgentInput {
  runId: AgentRunId;
  projectId: ProjectId;
  /** 1-based pass index within the run. */
  passNumber: number;
  mode: ReaderMode;
  context: AiContext;
  /** Required for `comprehension`: the single chapter being read. */
  chapter?: Chapter;
  /** Required for `comprehension`: 1-based index within the pass-1 traversal. */
  chapterIndex?: number;
  /** Required for `comprehension`: total chapters in the pass-1 scope. */
  totalChapters?: number;
  /** Optional for `thematic` / `self-answer`: chapter id subset. */
  chapterIdsInScope?: ChapterId[];
}

/**
 * Build a Reader agent for one pass. Three modes share the same
 * `kind: "reader"` agent shape but differ in system prompt, tool whitelist,
 * briefing, and traversal pattern (see `runReaderLoop`):
 *
 *  - `comprehension`: forward-only, ONE chapter inlined, no chapter-reading
 *    tools. Each chapter spawns its own agent invocation; the reader bible
 *    is the only memory across chapters.
 *  - `thematic`: single whole-work invocation. Search-driven motif/symbol
 *    hypothesis testing; writes only to motifs/, symbols/, subtext/.
 *  - `self-answer`: single whole-work invocation. Walks open `question(...)`
 *    entries and surfaces resolutions via `propose_answer`.
 */
export function makeReaderAgent(input: MakeReaderAgentInput): Agent {
  switch (input.mode) {
    case "comprehension":
      return makeComprehensionAgent(input);
    case "thematic":
      return makeThematicAgent(input);
    case "self-answer":
      return makeSelfAnswerAgent(input);
  }
}

function makeComprehensionAgent(input: MakeReaderAgentInput): Agent {
  if (!input.chapter || !input.chapterIndex || !input.totalChapters) {
    throw new Error(
      "comprehension mode requires chapter, chapterIndex, totalChapters",
    );
  }

  const systemPrompt = withScreenplaySuffix(
    withVoiceMandate(COMPREHENSION_SYSTEM_PROMPT),
    input.context,
  );

  // The per-chapter briefing is pushed into `segmentHistory` by the loop and
  // arrives via `history`, not `initialMessages`. This lets the briefing
  // (and the agent's response to it) persist as we accumulate chapters
  // within a segment, and survive across runAgent invocations.
  return {
    id: `reader:${input.runId}:pass-${input.passNumber}:comprehension:ch-${input.chapterIndex}`,
    kind: "reader",
    runId: input.runId,
    enableToolCalling: true,
    allowedToolIds: [...READER_COMPREHENSION_TOOLS],
    maxIterations: 32,
    buildMessages: makeAgentBuildMessages({
      systemPrompt,
      context: input.context,
      enableToolCalling: true,
    }),
    agentContext: {
      projectId: input.projectId,
      runId: input.runId,
      agentKind: "reader",
      passNumber: input.passNumber,
      // Forward-only enforcement: chapter-reading tools refuse content for
      // chapters with `order` greater than this bound.
      maxReadableChapterOrder: input.chapter.order,
    },
    systemPrompt,
  };
}

function makeThematicAgent(input: MakeReaderAgentInput): Agent {
  const initialMessages: AiMessage[] = [
    {
      role: "user",
      content: buildThematicBriefing({
        passNumber: input.passNumber,
        chapterIdsInScope: input.chapterIdsInScope,
      }),
    },
    {
      role: "assistant",
      content:
        "Understood. I'll start by inspecting voice/ and open_threads/ to gather candidates, then hypothesise and confirm via search and re-read.",
    },
  ];

  const systemPrompt = withScreenplaySuffix(
    withVoiceMandate(THEMATIC_SYSTEM_PROMPT),
    input.context,
  );

  return {
    id: `reader:${input.runId}:pass-${input.passNumber}:thematic`,
    kind: "reader",
    runId: input.runId,
    enableToolCalling: true,
    allowedToolIds: [...READER_THEMATIC_TOOLS],
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
      agentKind: "reader",
      passNumber: input.passNumber,
    },
    systemPrompt,
  };
}

function makeSelfAnswerAgent(input: MakeReaderAgentInput): Agent {
  const initialMessages: AiMessage[] = [
    {
      role: "user",
      content: buildSelfAnswerBriefing({
        passNumber: input.passNumber,
        chapterIdsInScope: input.chapterIdsInScope,
      }),
    },
    {
      role: "assistant",
      content:
        'Understood. I\'ll start with list_questions(status="open") and walk each one against the text.',
    },
  ];

  const systemPrompt = withScreenplaySuffix(
    withVoiceMandate(SELF_ANSWER_SYSTEM_PROMPT),
    input.context,
  );

  return {
    id: `reader:${input.runId}:pass-${input.passNumber}:self-answer`,
    kind: "reader",
    runId: input.runId,
    enableToolCalling: true,
    allowedToolIds: [...READER_SELF_ANSWER_TOOLS],
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
      agentKind: "reader",
      passNumber: input.passNumber,
    },
    systemPrompt,
  };
}
