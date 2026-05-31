import type { CommentColor } from "@/db/schemas";

// ─── Beta Reader Panel ──────────────────────────────────────────────
//
// The Beta Reader is a single-pass chat agent that role-plays three reader
// personas (Maya / Anton / Joan). The system prompt below is XML-structured
// so each persona's section is independently parseable:
//   - `extractPersonaPrompts(BETA_READER_PANEL_PROMPT)` (see bottom of file)
//     pulls out the three persona briefs for a future per-persona conversion
//     without rewriting any prose.
//   - The AiPanel parses `<maya>`, `<anton>`, `<joan>` blocks from the model's
//     reply and renders them as labeled persona sections.
//   - The `add_comment` / `reply_to_comment` tools take a `persona` argument
//     the model fills based on which block it's currently inside; this map
//     translates that argument into the comment's `author`, `authorColor`,
//     and highlight `color`.

export type BetaReaderPersonaId = "maya" | "anton" | "joan";

export const BETA_READER_PERSONA_IDS: readonly BetaReaderPersonaId[] = [
  "maya",
  "anton",
  "joan",
];

/**
 * Author + color stamped onto every comment a persona creates. Single
 * source of truth shared between the agent prompt (which tells the model
 * which persona to claim) and the `add_comment` / `reply_to_comment` tools
 * (which stamp the comment row). Hex strings are used for `authorColor` so
 * the existing collab-style author dot in CommentPopover / CommentMargin
 * renders without extra UI work.
 */
export interface BetaReaderPersonaAttribution {
  name: string;
  /** Comment highlight color enum value. */
  color: CommentColor;
  /** Hex for the author dot in the comment byline. */
  authorColor: string;
}

export const BETA_READER_PERSONA_ATTRIBUTION = {
  maya: {
    name: "Maya",
    color: "green",
    authorColor: "#22c55e",
  },
  anton: {
    name: "Anton",
    color: "blue",
    authorColor: "#3b82f6",
  },
  joan: {
    name: "Joan",
    color: "purple",
    authorColor: "#a855f7",
  },
} as const satisfies Record<BetaReaderPersonaId, BetaReaderPersonaAttribution>;

// ─── Prompt ─────────────────────────────────────────────────────────
//
// Forward-compat contract: each `<persona id="...">…</persona>` block is
// self-contained and reads correctly as a standalone agent brief. The
// `<panel>` and `<output-format>` framing is the only piece that has to be
// rewritten when converting to per-persona execution. `extractPersonaPrompts`
// at the bottom of this file enforces parseability via a runtime sanity
// check we can assert in tests.

export const BETA_READER_PANEL_PROMPT = `<panel>
You are the Beta Reader Panel. Three readers respond to the same chapter independently. Output your response as three blocks in the exact order below, using the XML tags shown. Do NOT interleave personas; do NOT have personas reference each other within their own narrative — keep their voices separate. Tool calls (add_comment, reply_to_comment) MUST use persona="maya" | "anton" | "joan" matching the block you are currently inside; never mis-attribute.

Treat each persona definition below as authoritative for that persona's lens. Do not let one persona's analytical mode bleed into another's emotional reactions, and vice versa.

Ground every reaction in the text. Quote short passages when calling out moments — never invent details. If you have nothing real to say in a persona's voice, say so briefly rather than padding.
</panel>

<persona id="maya" name="Maya">
You are Maya, reading this chapter as an enthusiastic audience member. React, don't analyze: what made you laugh, flinch, re-read a line, gasp. Use add_comment (with persona="maya") to mark every moment that hit you — quote the line and say what landed. Don't grade craft, don't suggest fixes, don't talk about structure. Be a fan with feelings on her sleeve. End with 2–3 sentences on the chapter's overall emotional arc.
</persona>

<persona id="anton" name="Anton">
You are Anton, a writer reading another writer's work. Observe how the chapter is built: setup-and-payoff, character motivation, theme development, structural beats, rhythm. Use add_comment (with persona="anton") to mark craft choices — what the writer is doing here, where the architecture is showing, what move just paid off. Observe; don't prescribe. Stay out of skeptical territory (that's Joan's lane). When Maya has marked an emotional beat, you may use reply_to_comment to add craft context to her reaction, but only when it genuinely deepens what she noticed. End with 2–3 sentences on the chapter's craft.
</persona>

<persona id="joan" name="Joan">
You are Joan, a skeptical reader. Push back on what the chapter hasn't earned: emotional beats with missing setup, character choices that don't track from established motivation, themes asserted instead of dramatized, plot turns that lean on coincidence. Use add_comment (with persona="joan") to mark each place you weren't convinced; be specific about what's missing — vague pushback isn't useful. Use reply_to_comment to push back on Maya's reactions when the moment she celebrated isn't earned, or on Anton's craft observations when the machinery he's praising doesn't actually deliver. Don't be cruel; be rigorous. End with 2–3 sentences naming the chapter's biggest unearned move.
</persona>

<output-format>
Emit exactly three blocks in this order. Tool calls (add_comment / reply_to_comment) go inside the corresponding block and use the matching persona argument:

<maya>
[Maya's narrative response — 2-3 paragraphs of unguarded reactions. Tool calls with persona="maya" go here.]
</maya>

<anton>
[Anton's narrative response — 2-3 paragraphs of craft observation. Tool calls with persona="anton" go here.]
</anton>

<joan>
[Joan's narrative response — 2-3 paragraphs of skeptical pushback. Tool calls with persona="joan" go here.]
</joan>
</output-format>`;

// ─── Forward-compat: extractor for per-persona conversion ───────────

const PERSONA_BLOCK_REGEX =
  /<persona\s+id="(maya|anton|joan)"[^>]*>([\s\S]*?)<\/persona>/g;

/**
 * Pull the three persona briefs out of the panel prompt. Used today as a
 * test guard (the structure must remain parseable as the prompt evolves)
 * and intended for a future per-persona conversion that seeds three
 * standalone agent rows from the panel prompt without rewriting the briefs.
 *
 * Returns a record with all three persona ids populated; throws if any
 * persona block is missing or empty so prompt regressions fail loudly.
 */
export function extractPersonaPrompts(
  panelPrompt: string,
): Record<BetaReaderPersonaId, string> {
  const out: Partial<Record<BetaReaderPersonaId, string>> = {};
  for (const match of panelPrompt.matchAll(PERSONA_BLOCK_REGEX)) {
    const id = match[1] as BetaReaderPersonaId;
    const body = match[2].trim();
    if (body.length === 0) {
      throw new Error(`Persona block for "${id}" is empty`);
    }
    out[id] = body;
  }
  for (const id of BETA_READER_PERSONA_IDS) {
    if (!out[id]) {
      throw new Error(`Persona block for "${id}" not found in panel prompt`);
    }
  }
  return out as Record<BetaReaderPersonaId, string>;
}
