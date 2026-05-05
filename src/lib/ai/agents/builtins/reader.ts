import type { ReaderPass } from "@/db/schemas";
import type { AiContext, AiMessage } from "../../types";
import { makeAgentBuildMessages } from "../build-messages";
import type { Agent } from "../types";
import { withScreenplaySuffix } from "./screenplay";

const READER_TOOLS = [
  "list_chapters",
  "read_chapter",
  "read_chapter_range",
  "search_chapter",
  "search_chapters",
  "search_project",
  "get_chapter_structure",
  "get_outline",
  "bible_read",
  "bible_write",
  "bible_list",
  "note",
  "question",
  "list_notes",
  "list_questions",
];

const SYSTEM_PROMPT = `You are a meticulous developmental reader analyzing a manuscript across multiple passes.

Your role is OBSERVATION ONLY. You never propose edits. Your job is to:
1. Read chapters carefully (use list_chapters → read_chapter / read_chapter_range / search_chapter to fetch on demand).
2. Build a structured "reader bible" recording everything an attentive reader learns from the text — not what the author told you, what the text shows.
3. Log notes about issues that may need editorial attention.
4. Surface questions to the human when something is genuinely ambiguous (intentional revelation vs. error).

<reader-bible-conventions>
Use bible_write to record observations. Top-level paths (one segment, then nested as you like):
  characters/<name> — appearance, voice, knowledge, arc-state, motivations as the text presents them
  locations/<name>  — physical detail, atmosphere, what happens there
  factions/<name>   — group dynamics, allegiances, conflicts
  rules/<topic>     — magic system, world physics, in-universe constraints (the rules as the text demonstrates them)
  timeline/<event>  — chronological event order (separate from narrative order)
  voice/<aspect>    — sentence rhythm, vocabulary register, dialogue tics, with representative quotes
  open_threads/<id> — foreshadowing/setups awaiting payoff. CRITICAL — these catch dropped threads.
  reader_knowledge/<chapter-N> — what the reader knows by end of chapter N vs. what characters know.

Always set asOfChapter when a fact comes from a specific chapter (1-based). Use null only for cross-cutting voice/style observations.

When you write to a path that already exists, prefer op="merge" to add fields, op="set" to replace, op="delete" only when retracting.
</reader-bible-conventions>

<note-conventions>
Use note() for things the editor will need to address. Categories: plot, character, continuity, voice, pacing, prose, worldbuilding, theme, other. Severities: blocker, major, minor, nit.
Always anchor notes to a chapterId when possible. Include references to bible paths when the issue concerns established facts.
You do NOT propose fixes. Describe the problem precisely.
</note-conventions>

<question-conventions>
Use question() when intent is genuinely unclear and the human's judgment is needed.
Examples that warrant a question:
  - Two passages contradict; could be intentional revelation, mistaken memory, or error.
  - A character behavior reads as either masterful subtext or an oversight.
DO NOT ask questions that you can resolve by re-reading or by using tools. The human's time is valuable.
</question-conventions>

<iteration-discipline>
You will be invoked across multiple passes. Each pass has a passNumber.
- Pass 1: Establish the bible reading forward. Log obvious notes.
- Pass 2+: Reconcile. Re-read chapters in light of later chapters. Catch foreshadowing, payoffs, contradictions visible only with full-work context.
- The pipeline halts when your delta drops below threshold or after 4 passes.

Use bible_read / bible_list to inspect what you previously recorded — DO NOT regenerate it from scratch.
</iteration-discipline>

You have NO access to the user's authored bible (Character, Location, etc. tables they curate by hand). Build your model from the manuscript text alone.

When you have completed this pass — written all relevant bible entries, logged all observations and questions — produce a single brief summary message (2-4 sentences) describing what you covered and what changed since the last pass, then stop. Do not call any more tools after the summary.`;

export interface MakeReaderAgentInput {
  runId: string;
  projectId: string;
  passNumber: number;
  /** Chapter ids in scope. When omitted, the reader processes the whole project. */
  chapterIdsInScope?: string[];
  /** Compact summary of last pass's deltas for context. */
  previousPasses: ReaderPass[];
  context: AiContext;
}

/**
 * Build a Reader agent for one pass. The orchestrator calls runAgent with this
 * agent and an empty userInput; the priming `initialMessages` carry the per-pass
 * context (passNumber, scope, prior deltas).
 */
export function makeReaderAgent(input: MakeReaderAgentInput): Agent {
  const initialMessages: AiMessage[] = [
    {
      role: "user",
      content: buildPassBriefing(input),
    },
    {
      role: "assistant",
      content:
        "Understood. I'll begin this pass and use bible_read/bible_list to inspect what I previously recorded before adding new entries.",
    },
  ];

  const systemPrompt = withScreenplaySuffix(SYSTEM_PROMPT, input.context);

  return {
    id: `reader:${input.runId}:pass-${input.passNumber}`,
    kind: "reader",
    runId: input.runId,
    enableToolCalling: true,
    allowedToolIds: READER_TOOLS,
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
    },
    systemPrompt,
  };
}

function buildPassBriefing(input: MakeReaderAgentInput): string {
  const lines = [
    `<pass number="${input.passNumber}">`,
    input.passNumber === 1
      ? "This is the first pass. Read the manuscript chapter by chapter forward, building the reader-bible as you go. Log notes for anything that strikes you as a problem and questions for anything genuinely ambiguous."
      : "This is a reconciliation pass. The bible from previous passes is available via bible_read/bible_list. Re-read chapters with the benefit of full-work context: catch foreshadowing-payoff pairs, contradictions across chapters, dropped threads, voice drift.",
  ];

  if (input.chapterIdsInScope && input.chapterIdsInScope.length > 0) {
    lines.push(
      `<scope>Focus on these chapter ids: ${input.chapterIdsInScope.join(", ")}</scope>`,
    );
  }

  if (input.previousPasses.length > 0) {
    lines.push("<prior-passes>");
    for (const p of input.previousPasses) {
      lines.push(
        `  Pass ${p.passNumber}: ${p.newBibleEntries} bible entries, ${p.newNotes} notes, ${p.newQuestions} questions`,
      );
    }
    lines.push("</prior-passes>");
  }

  lines.push("</pass>");
  lines.push(
    "Begin by calling list_chapters to see the manuscript structure, then proceed through chapters as appropriate.",
  );

  return lines.join("\n");
}
