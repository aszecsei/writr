/**
 * Single inventory of which tools each chat agent may invoke.
 *
 * Tool ids must match registered ids in `AI_TOOLS`. The consolidated `list`
 * and `get` tools accept SCOPED ids (`list:chapter`, `get:summary`, etc.)
 * to limit which categories an agent can read. Use the unscoped `list` /
 * `get` to grant all categories.
 */

// ─── Chat-mode read baseline ─────────────────────────────────────────

/**
 * Broad read-only toolset for chat-mode agents. Mirrors `ALL_READ_TOOL_IDS`
 * in the AgentEditor's tool picker minus the pipeline-only groups (reader
 * bible, reader notes/questions) which require an active pipeline run.
 *
 * Spans every project read surface a writing-room collaborator might want:
 * the full story bible (per-category scoped ids), chapter metadata and
 * content, project-wide search, and the outline grid.
 */
export const CHAT_READS_BASE: readonly string[] = [
  // Story bible (scoped per-category for explicit narrowing in the UI).
  "list:character",
  "get:character",
  "list:location",
  "get:location",
  "list:timeline",
  "get:timeline",
  "list:style_guide",
  "get:style_guide",
  "list:guardrail",
  "get:guardrail",
  "list:worldbuilding",
  "get:worldbuilding",
  // Chapters: metadata, content, structure.
  "list:chapter",
  "get:chapter",
  "read_chapter",
  "read_chapter_range",
  "search_chapter",
  "search_chapters",
  "get_chapter_structure",
  "get:summary",
  // Project-wide.
  "get:outline",
  "search_project",
];

// ─── Reader ──────────────────────────────────────────────────────────

/**
 * Chat-mode reader: read-only review of the manuscript and bible. Same
 * surface as the broad chat baseline — readers ground their answers in
 * the bible and chapter content but never mutate.
 */
export const READER_CHAT_TOOLS: readonly string[] = [...CHAT_READS_BASE];

// ─── Editor ──────────────────────────────────────────────────────────

/**
 * Chat-mode editor: full read surface so the model can ground its edits
 * in surrounding chapters and bible context, plus `propose_edit` for
 * staging "rewrite this" suggestions. The model can still write prose
 * inline; staging-via-tool is opt-in.
 */
export const EDITOR_CHAT_TOOLS: readonly string[] = [
  ...CHAT_READS_BASE,
  "propose_edit",
];

// ─── Beta Reader ─────────────────────────────────────────────────────

/**
 * Beta Reader panel: full read surface so personas can ground their
 * reactions in surrounding chapters and bible, plus the comment-creation
 * tools. Comments are written directly to Dexie (auto-execute, no approval
 * gate) — the user reviews them in the editor margin afterwards.
 */
export const BETA_READER_TOOLS: readonly string[] = [
  ...CHAT_READS_BASE,
  "add_comment",
  "reply_to_comment",
];

// ─── Outline Architect ───────────────────────────────────────────────

/**
 * Outline Architect: full read surface (it reads the existing outline via
 * `get:outline` and grounds beats in the bible/chapters) plus the four
 * grid-management tools. All four mutate the outline grid and require
 * approval; the agent stays inside the grid and has no chapter-mutating tools.
 */
export const OUTLINE_ARCHITECT_TOOLS: readonly string[] = [
  ...CHAT_READS_BASE,
  "manage_outline_columns",
  "manage_outline_rows",
  "write_outline_cell",
  "set_outline_cell_color",
];

// ─── Worldbuilder ────────────────────────────────────────────────────

/**
 * Worldbuilder: full read surface (it grounds new world facts in existing
 * characters, locations, and docs before writing) plus the four worldbuilding
 * doc-management tools. All four mutate the world bible and require approval;
 * the agent stays inside worldbuilding and has no chapter- or
 * character-mutating tools.
 */
export const WORLDBUILDER_TOOLS: readonly string[] = [
  ...CHAT_READS_BASE,
  "create_worldbuilding_doc",
  "update_worldbuilding_doc",
  "delete_worldbuilding_doc",
  "move_worldbuilding_doc",
];

// ─── Orchestrator (chat) ─────────────────────────────────────────────

/**
 * Chat-mode orchestrator: the full chat read surface plus the two
 * orchestration tools. `delegate` runs a named sub-agent on a self-contained
 * subtask and returns only its final answer (keeping the orchestrator's
 * context lean); `present_choice` pauses to ask the user a decision. The
 * orchestrator reads to scope work and delegates the rest — it has no
 * mutating tools of its own.
 */
export const ORCHESTRATOR_CHAT_TOOLS: readonly string[] = [
  ...CHAT_READS_BASE,
  "delegate",
  "present_choice",
];

// ─── Researcher / Prose Writer (orchestrated scene-writing) ──────────

/**
 * Researcher: read-only investigation surface, same as Reader. Given a scene
 * concept it grounds a research brief in the bible and prior chapters
 * (character voices/knowledge, worldbuilding, prior events) — it never mutates
 * and never writes prose.
 */
export const RESEARCHER_TOOLS: readonly string[] = [...CHAT_READS_BASE];

/**
 * Prose Writer: full read surface so it can pull a verbatim callback or check a
 * fact, but its prompt treats the supplied brief + beats as authoritative and
 * discourages re-research. No mutating tools — it only emits prose.
 */
export const PROSE_WRITER_TOOLS: readonly string[] = [...CHAT_READS_BASE];

// ─── Chat / Brainstorm / Character Dialogue ──────────────────────────

/**
 * Free-form Chat agent: same broad read surface as Reader. Used by the
 * "Chat" built-in for writer's-room conversations where the model needs
 * on-demand access to anything in the project.
 */
export const CHAT_TOOLS: readonly string[] = [...CHAT_READS_BASE];

/**
 * Brainstorm agent: bible reads + outline + project-wide search, but no
 * chapter content. Brainstorms work from premises and the bible — letting
 * the model pull entire chapters tends to produce summaries instead of
 * fresh ideas.
 */
export const BRAINSTORM_TOOLS: readonly string[] = [
  "list:character",
  "get:character",
  "list:location",
  "get:location",
  "list:timeline",
  "get:timeline",
  "list:style_guide",
  "get:style_guide",
  "list:guardrail",
  "get:guardrail",
  "list:worldbuilding",
  "get:worldbuilding",
  "get:outline",
  "search_project",
];

/**
 * Character Dialogue agent: minimal surface for voice consistency —
 * character voice cues and the style guide. No chapter access; dialogue
 * is generated from voice notes, not by mimicking prior scenes verbatim.
 */
export const CHARACTER_DIALOGUE_TOOLS: readonly string[] = [
  "list:character",
  "get:character",
  "list:style_guide",
  "get:style_guide",
  "list:guardrail",
  "get:guardrail",
];
