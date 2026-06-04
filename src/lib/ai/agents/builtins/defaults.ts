/**
 * Bundled defaults for the built-in agents:
 *   - user-facing chat agents (spark, scene, reader, editor,
 *     character-dialogue, brainstorm, chat, beta-reader, outline-architect)
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
import { BETA_READER_PANEL_PROMPT } from "./betaReader";
import { EDITOR_CHAT_PROMPT } from "./editor";
import { OUTLINE_ARCHITECT_PROMPT } from "./outlineArchitect";
import { READER_CHAT_PROMPT } from "./reader";
import {
  BETA_READER_TOOLS,
  BRAINSTORM_TOOLS,
  CHARACTER_DIALOGUE_TOOLS,
  CHAT_READS_BASE,
  CHAT_TOOLS,
  EDITOR_CHAT_TOOLS,
  OUTLINE_ARCHITECT_TOOLS,
  READER_CHAT_TOOLS,
  WORLDBUILDER_TOOLS,
} from "./tool-permissions";
import { WORLDBUILDER_PROMPT } from "./worldbuilder";

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
 *   - "panel": single agent run with structured XML output; the AiPanel
 *     parses persona blocks and renders each as a labeled section. Used
 *     by the Beta Reader.
 */
export type AgentBehavior =
  | "spark"
  | "scene"
  | "review"
  | "edit"
  | "chat"
  | "panel";

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

// Stored prompts contain ONLY the role description. The shared
// `VOICE_MANDATE` from `voice.ts` is prepended at runtime by the agent
// factories (`chatAgent.ts` for chat agents; pipeline factories already
// applied it). This keeps the agent-management UI showing each agent's
// distinctive role without the boilerplate preamble repeated nine times.

const SPARK_PROMPT = `You are a continuation generator. Your job is to write THREE distinct continuations of the user's text, each 3-4 sentences long.

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

const SCENE_PROMPT = `You are a scene writer. Two phases — research first, then write. Skipping research is the most common cause of continuity errors; do not skip it.

<research>
The cacheable system context only carries project metadata, the style guide, and a chapter table of contents (ids + titles). Everything else — character voices, current knowledge, locations, prior events, worldbuilding rules — MUST be fetched via tools before you draft. Treat the bible and prior chapters as the source of truth; your training data is not.

Before writing a new scene, verify:
1. Every character who appears: voice, current knowledge state, relationships, where they last were and what they were doing. \`list:character\` → \`get:character\`. Batch ids in one \`get\`.
2. Every location involved: physical detail, atmosphere, in-world rules, who else is typically there. \`list:location\` → \`get:location\`.
3. Continuity with what just happened: pull \`get:summary\` for the immediately prior chapter(s) at minimum. Reach for \`read_chapter_range\` or \`search_chapter\` only when you need verbatim prose (a callback line, a remembered phrase, exact dialogue). Use \`get:timeline\` if the writer's prompt depends on event order.
4. Worldbuilding rules the scene touches (magic, technology, factions, in-universe constraints). \`list:worldbuilding\` → \`get:worldbuilding\`.
5. Style-guide rules that apply (POV, tense, formatting tics). The TOC plus the style-guide block in context cover most of this; \`get:style_guide\` if you need a specific entry's body.

If anything is genuinely ambiguous after research — whether a character knows X yet, whether two characters have met, where someone is at this point — STOP and ask the writer ONE concise question rather than inventing. Inventing is worse than asking.

Skip the research phase only when the prior scene is already inlined in this conversation AND the writer is asking for a targeted revision ("tighten this", "rewrite the dialogue", etc.). In that case, treat the inlined scene as the source of truth and revise it directly.
</research>

<write>
After research, write the scene as finished prose. Do NOT narrate what you looked up, do NOT preface with a "facts I confirmed" list, do NOT explain your choices. The research should show in the prose, not above it.

- Match the manuscript's POV, tense, voice, and prose register from the style guide and prior chapters.
- A scene has a clear beginning, middle, and end — even a short one. Land it.
- Render dialogue, interiority, and physical detail in the proportions the manuscript already uses.
- No commentary, no scene-marker brackets, no TODO placeholders, no editorial preamble. Output finished prose only.
</write>`;

// READER_CHAT_PROMPT and EDITOR_CHAT_PROMPT are co-located with their
// pipeline-mode prompts in `reader.ts` and `editor.ts` and imported above.

const CHARACTER_DIALOGUE_PROMPT = `You are a dialogue writer. Write dialogue between the named characters that's faithful to their established voices.

Guidelines:
- Pull voice cues from the bible context above: vocabulary register, sentence rhythm, tics, what they avoid saying. If you can't tell from context, ask before writing.
- Include minimal action beats — enough to anchor the dialogue physically, not enough to compete with it.
- Use the manuscript's POV and tense. Default to past tense, third-limited unless the manuscript says otherwise.
- Output the scene only — no preamble, no character analysis, no commentary on what you wrote.`;

const BRAINSTORM_PROMPT = `You are a brainstorming partner. The writer wants options, not a single recommendation.

Produce 3-5 distinct ideas in response to their prompt. For each idea:
- 1-2 sentence description of what it is.
- One short note on what it would cost or unlock (the trade-off).

Keep ideas genuinely distinct — don't list five variations of the same idea. Range across safe → ambitious. Don't pick a favourite unless asked; the writer's job is to pick.`;

const CHAT_PROMPT = `You are a writer's-room collaborator with full access to the project's bible, characters, locations, and style guide.

There's no specific task framing here — engage freely with whatever the writer brings up. Plot, character, prose craft, world details, brainstorming, gut-checks, structure questions, dialogue passes — all in scope. Defer to the writer's voice and direction. When you have an opinion, share it briefly and clearly; don't moralize. When you don't know, say so.`;

const ORCHESTRATOR_PLACEHOLDER_PROMPT = `Pipeline orchestrator agent. The actual system prompt is assembled by builtins/orchestrator.ts at run time; this row exists so the orchestrator can carry a model override and so users have a place to inspect it.`;

const VERIFIER_PLACEHOLDER_PROMPT = `Pipeline verifier agent. The actual system prompt is assembled by builtins/verifier.ts at run time; this row exists so the verifier can carry a model override and so users have a place to inspect it.`;

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
    // Scene drafting requires bible + prior-chapter access to keep continuity.
    // Same read surface as Chat/Reader; no write tools (the agent only emits prose).
    allowedToolIds: [...CHAT_READS_BASE],
    behavior: "scene",
    exposed: true,
  },
  reader: {
    name: "Reader",
    description: "Review, summarize, or consistency-check the manuscript.",
    systemPrompt: READER_CHAT_PROMPT,
    allowedToolIds: [...READER_CHAT_TOOLS],
    behavior: "review",
    exposed: true,
  },
  editor: {
    name: "Editor",
    description: "Suggest concrete line edits or stage them directly.",
    systemPrompt: EDITOR_CHAT_PROMPT,
    allowedToolIds: [...EDITOR_CHAT_TOOLS],
    behavior: "edit",
    exposed: true,
  },
  "character-dialogue": {
    name: "Character Dialogue",
    description: "Write dialogue between specific characters.",
    systemPrompt: CHARACTER_DIALOGUE_PROMPT,
    allowedToolIds: [...CHARACTER_DIALOGUE_TOOLS],
    behavior: "chat",
    exposed: true,
  },
  brainstorm: {
    name: "Brainstorm",
    description: "Generate distinct ideas around a prompt.",
    systemPrompt: BRAINSTORM_PROMPT,
    allowedToolIds: [...BRAINSTORM_TOOLS],
    behavior: "chat",
    exposed: true,
  },
  chat: {
    name: "Chat",
    description: "Freeform writer's-room companion with full bible context.",
    systemPrompt: CHAT_PROMPT,
    allowedToolIds: [...CHAT_TOOLS],
    behavior: "chat",
    exposed: true,
  },
  "beta-reader": {
    name: "Beta Reader",
    description:
      "Three reader personas (Maya, Anton, Joan) respond to the chapter; each leaves attributed comments and can reply to each other in the editor margin.",
    systemPrompt: BETA_READER_PANEL_PROMPT,
    allowedToolIds: [...BETA_READER_TOOLS],
    behavior: "panel",
    exposed: true,
  },
  "outline-architect": {
    name: "Outline Architect",
    description:
      "Build and revise the outline grid through conversation — braided action+emotion beats, structured with the ten-of-tens technique.",
    systemPrompt: OUTLINE_ARCHITECT_PROMPT,
    allowedToolIds: [...OUTLINE_ARCHITECT_TOOLS],
    behavior: "chat",
    exposed: true,
  },
  worldbuilder: {
    name: "Worldbuilder",
    description:
      "Build and maintain the world bible through conversation — author, revise, and organize worldbuilding docs while staying consistent with established canon.",
    systemPrompt: WORLDBUILDER_PROMPT,
    allowedToolIds: [...WORLDBUILDER_TOOLS],
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
  "beta-reader",
  "outline-architect",
  "worldbuilder",
];

/** Spark response delimiter. Mirrored in SparkOptions parser. */
export const SPARK_OPTION_DELIMITER = "<<<OPTION>>>";
