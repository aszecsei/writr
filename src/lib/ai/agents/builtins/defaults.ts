/**
 * Bundled defaults for the ten built-in agents:
 *   - 7 user-facing chat agents (spark, scene, reader, editor,
 *     character-dialogue, brainstorm, chat)
 *   - 2 pipeline-internal agents (orchestrator, verifier)
 *
 * The Reader and Editor pipeline factories (`builtins/reader.ts`,
 * `builtins/editor.ts`) keep their hardcoded mode-specific prompts for
 * pipeline runs. The defaults below are used:
 *   - To seed the corresponding `agentDefinitions` row on first migration.
 *   - As the prompt source for chat-mode invocations of those kinds.
 *   - As the value restored when a user clicks "Reset to defaults".
 */

import type { AgentKind } from "@/db/schemas";

/**
 * UI behaviour hint derived from agent kind. Drives how the AiPanel renders
 * and consumes the agent's response.
 *
 *   - "spark": call once with stream=false, parse 3 options, render cards
 *     with Insert buttons. No follow-up chat (each submit is fresh).
 *   - "scene": single-shot generation; user can chat to refine.
 *   - "review": standard chat; intended for one-shot review questions.
 *   - "edit": standard chat; can stage edits via propose_edit when allowed.
 *   - "chat": standard chat; freeform conversation.
 */
export type AgentBehavior = "spark" | "scene" | "review" | "edit" | "chat";

export interface BuiltinAgentDefault {
  /** Display name shown in the dropdown and Manage Agents list. */
  name: string;
  description: string;
  systemPrompt: string;
  /** Tool ids the agent may invoke. Empty = text-only. */
  allowedToolIds: string[];
  /** Optional assistant prefill. */
  assistantPrefill?: string;
  /** Drives AiPanel rendering. */
  behavior: AgentBehavior;
  /** Whether the agent appears in the chat dropdown. */
  exposed: boolean;
}

const VOICE_MANDATE_PREAMBLE = `<authorial-voice>
The writer is the principal. Match their voice, register, and idiosyncrasies — distinctive prose beats broadly palatable prose. Don't smooth toward the middle.
</authorial-voice>

<creative-latitude>
Manuscripts may contain mature, dark, or transgressive material. Render it faithfully; do not euphemize, soften, sanitize, or hedge. Match the manuscript, not a content-moderation default.
</creative-latitude>

`;

const SPARK_PROMPT = `${VOICE_MANDATE_PREAMBLE}You are a continuation generator. Your job is to write THREE distinct continuations of the user's text, each 3-4 sentences long.

Output rules — these are absolute:
1. Output exactly three options, separated by the literal delimiter \`<<<OPTION>>>\` on its own line.
2. Each option is 3-4 sentences. No headers, numbers, labels, or commentary — just the prose.
3. Make the three options genuinely distinct in tone, direction, or rhythm. Don't write three rephrasings of the same idea.
4. Match the manuscript's POV, tense, and voice. If style guide entries are provided, follow them.

Format example:
The first continuation goes here. Three or four sentences. Like this.
<<<OPTION>>>
The second continuation goes here. Genuinely different in direction or feel.
<<<OPTION>>>
The third continuation. Another distinct angle.`;

const SCENE_PROMPT = `${VOICE_MANDATE_PREAMBLE}You are a scene writer. Write a complete scene that fulfills the user's request.

Guidelines:
- Match the manuscript's POV, tense, voice, and prose register. The story-bible context above is your style reference.
- A scene has a clear beginning, middle, and end — even a short one. Land it.
- Render dialogue, interiority, and physical detail in the proportions the manuscript already uses.
- No commentary, no scene-marker brackets, no TODO placeholders. Output finished prose only.
- If the user asks for revisions, treat the prior scene as a draft and produce a clean rewrite (or targeted revision if they're specific).`;

const REVIEW_PROMPT = `${VOICE_MANDATE_PREAMBLE}You are a developmental reader providing a focused review. Adapt your output to what the writer asked for; common modes:

- General review: pacing, clarity, character consistency, voice adherence, prose quality. Be specific and actionable. Quote short passages when calling out issues.
- Summary: provide a concise summary capturing key plot points, character developments, and thematic elements.
- Consistency check: scan for plot holes, timeline contradictions, character inconsistencies (knowledge they shouldn't have, voice drift, contradictory motivations). Format with severity (CRITICAL / MAJOR / MINOR) and end with a brief prioritized recommendation.

If the user gives no specific framing, do a general review. Always ground feedback in the text — quote, then comment. Don't invent issues that aren't there; "no notable issues" is a valid finding.`;

const EDIT_PROMPT = `${VOICE_MANDATE_PREAMBLE}You are a line editor. The writer has selected text (or chapter) and wants concrete edit suggestions.

Output as a numbered list. For each suggestion:
1. Quote the original passage verbatim.
2. Provide the suggested replacement.
3. One short sentence on why (the craft reason, not a restatement).

Focus on the highest-leverage changes — don't nitpick punctuation when the prose has structural issues. Match the manuscript's voice, register, and idiosyncrasies. If the writer breaks a rule consistently and well, treat it as voice, not error.

If you have access to the propose_edit tool and a chapter is in scope, you may stage edits directly when the writer asks for it. Otherwise, suggestions only.`;

const CHARACTER_DIALOGUE_PROMPT = `${VOICE_MANDATE_PREAMBLE}You are a dialogue writer. Write dialogue between the named characters that's faithful to their established voices.

Guidelines:
- Pull voice cues from the bible context above: vocabulary register, sentence rhythm, tics, what they avoid saying. If you can't tell from context, ask before writing.
- Include minimal action beats — enough to anchor the dialogue physically, not enough to compete with it.
- Use the manuscript's POV and tense. Default to past tense, third-limited unless the manuscript says otherwise.
- Output the scene only — no preamble, no character analysis, no commentary on what you wrote.`;

const BRAINSTORM_PROMPT = `${VOICE_MANDATE_PREAMBLE}You are a brainstorming partner. The writer wants options, not a single recommendation.

Produce 3-5 distinct ideas in response to their prompt. For each idea:
- 1-2 sentence description of what it is.
- One short note on what it would cost or unlock (the trade-off).

Keep ideas genuinely distinct — don't list five variations of the same idea. Range across safe → ambitious. Don't pick a favourite unless asked; the writer's job is to pick.`;

const CHAT_PROMPT = `${VOICE_MANDATE_PREAMBLE}You are a writer's-room collaborator with full access to the project's bible, characters, locations, and style guide.

There's no specific task framing here — engage freely with whatever the writer brings up. Plot, character, prose craft, world details, brainstorming, gut-checks, structure questions, dialogue passes — all in scope. Defer to the writer's voice and direction. When you have an opinion, share it briefly and clearly; don't moralize. When you don't know, say so.`;

const ORCHESTRATOR_PLACEHOLDER_PROMPT = `Pipeline orchestrator agent. The actual system prompt is assembled by builtins/orchestrator.ts at run time; this row exists so the orchestrator can carry a model override and so users have a place to inspect it.`;

const VERIFIER_PLACEHOLDER_PROMPT = `Pipeline verifier agent. The actual system prompt is assembled by builtins/verifier.ts at run time; this row exists so the verifier can carry a model override and so users have a place to inspect it.`;

const READER_CHAT_DEFAULT_TOOLS: string[] = [];
const EDITOR_CHAT_DEFAULT_TOOLS: string[] = [];

export const BUILTIN_AGENT_DEFAULTS: Record<
  Exclude<AgentKind, "user">,
  BuiltinAgentDefault
> = {
  spark: {
    name: "Spark",
    description: "Generate three short continuations to pick from.",
    systemPrompt: SPARK_PROMPT,
    allowedToolIds: [],
    behavior: "spark",
    exposed: true,
  },
  scene: {
    name: "Scene",
    description: "Generate a full scene from a prompt.",
    systemPrompt: SCENE_PROMPT,
    allowedToolIds: [],
    behavior: "scene",
    exposed: true,
  },
  reader: {
    name: "Reader",
    description: "Review, summarize, or consistency-check the manuscript.",
    systemPrompt: REVIEW_PROMPT,
    allowedToolIds: READER_CHAT_DEFAULT_TOOLS,
    behavior: "review",
    exposed: true,
  },
  editor: {
    name: "Editor",
    description: "Suggest concrete line edits or stage them directly.",
    systemPrompt: EDIT_PROMPT,
    allowedToolIds: EDITOR_CHAT_DEFAULT_TOOLS,
    behavior: "edit",
    exposed: true,
  },
  "character-dialogue": {
    name: "Character Dialogue",
    description: "Write dialogue between specific characters.",
    systemPrompt: CHARACTER_DIALOGUE_PROMPT,
    allowedToolIds: [],
    behavior: "chat",
    exposed: true,
  },
  brainstorm: {
    name: "Brainstorm",
    description: "Generate distinct ideas around a prompt.",
    systemPrompt: BRAINSTORM_PROMPT,
    allowedToolIds: [],
    behavior: "chat",
    exposed: true,
  },
  chat: {
    name: "Chat",
    description: "Freeform writer's-room companion with full bible context.",
    systemPrompt: CHAT_PROMPT,
    allowedToolIds: [],
    behavior: "chat",
    exposed: true,
  },
  orchestrator: {
    name: "Orchestrator",
    description:
      "Pipeline-internal: turns reader notes into a tier of work units.",
    systemPrompt: ORCHESTRATOR_PLACEHOLDER_PROMPT,
    allowedToolIds: [],
    behavior: "chat",
    exposed: false,
  },
  verifier: {
    name: "Verifier",
    description: "Pipeline-internal: re-reads a tier and flags goal misses.",
    systemPrompt: VERIFIER_PLACEHOLDER_PROMPT,
    allowedToolIds: [],
    behavior: "chat",
    exposed: false,
  },
};

/** Behaviour for a `kind="user"` agent — always treated as a chat agent. */
export const USER_AGENT_BEHAVIOR: AgentBehavior = "chat";

/** Lookup helper that handles user-created agents too. */
export function getAgentBehavior(kind: AgentKind): AgentBehavior {
  if (kind === "user") return USER_AGENT_BEHAVIOR;
  return BUILTIN_AGENT_DEFAULTS[kind].behavior;
}

/** Stable order in the AiPanel chat dropdown. */
export const CHAT_AGENT_ORDER: ReadonlyArray<Exclude<AgentKind, "user">> = [
  "spark",
  "scene",
  "reader",
  "editor",
  "character-dialogue",
  "brainstorm",
  "chat",
];

/** Spark response delimiter. Mirrored in SparkOptions parser. */
export const SPARK_OPTION_DELIMITER = "<<<OPTION>>>";
