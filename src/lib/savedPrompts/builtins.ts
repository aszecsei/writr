/**
 * Bundled defaults for built-in saved prompts.
 *
 * These are used:
 *   - To seed the corresponding `savedPrompts` row on app boot (idempotently,
 *     keyed by `builtinKey`).
 *   - As the value restored when a user clicks "Reset to default" on a built-in
 *     prompt.
 *
 * A `savedPrompts` row with a non-null `builtinKey` is a built-in: it is
 * non-deletable and resettable, but its title/body remain user-editable
 * (mirrors the built-in agent pattern). Rows with `builtinKey: null` are
 * user-created.
 */

export interface BuiltinSavedPrompt {
  title: string;
  body: string;
}

/**
 * Orchestrated scene-writing workflow. Designed to be run with the
 * **Orchestrator** agent active: the body is the orchestrator's instruction and
 * names the sub-agents it should delegate to by their display names
 * (`Researcher`, `Prose Writer`, `Editor`).
 */
const SCENE_WRITING_BODY = `Write the next scene using a staged workflow. You are the orchestrator: plan in your own context, delegate the verbose and specialized work, and synthesize the result. Work the passes in order — do not skip ahead to drafting.

Pass 1 — Concept (you): Read just enough to scope the scene — the chapter list, the summary of the immediately prior chapter, and the scene brief below. Form a one-paragraph high-level concept: what this scene must accomplish and the tension that drives it. Don't do the detailed lookups yourself.

Pass 2 — Research (delegate to "Researcher"): Hand it the concept as a complete, standalone briefing. Have it return a structured research brief — the established voice, current knowledge, relationships, and recent arc of every character who appears; the worldbuilding the scene touches; and relevant prior events, searched rather than assumed — with citations. If the brief surfaces a genuine ambiguity that changes the scene (does a character know X yet, have two characters met, where is someone now), use present_choice to ask the writer rather than guessing.

Pass 3 — Beats (you): From the concept and the research brief, plan the scene. List what to include, what to imply, and what to avoid, using narrative tension as the guide. Note the themes and the memorable details you want to land. Outline the beat structure — where it opens, the turns it moves through, and where it ends — and mark which research details get woven in where.

Pass 4 — Prose (delegate to "Prose Writer"): Give it the concept, the full research brief, and the beats as one self-contained briefing. Instruct it to write loose and fast — energy, instinct, and bold choices over polish — to integrate worldbuilding as lived-in detail rather than exposition, and to keep every character consistent with the brief. It should output finished prose only.

Pass 5 — Edit (delegate to "Editor"): Give it the draft plus the research brief. Have it return a polished final draft as prose text (not staged edits): tighten the language, fix any continuity slip against the brief, and sharpen each voice — without flattening the draft's energy.

Present the finished scene to the writer. Note briefly anything you had to assume or any open question the research surfaced.

--- Scene brief (fill in) ---
Chapter / position:
What should happen:
Characters present:
Constraints / must-haves:`;

export const BUILTIN_SAVED_PROMPTS: Record<string, BuiltinSavedPrompt> = {
  "scene-writing": {
    title: "Scene Writing (Orchestrated)",
    body: SCENE_WRITING_BODY,
  },
};
