/**
 * Single inventory of which tools each agent variant may invoke.
 *
 * Agent kinds map to multiple variants when an agent is invoked under
 * different operating contexts:
 *   - Reader has a chat variant (broad reads, no writes) and three pipeline
 *     modes (comprehension / thematic / self-answer).
 *   - Editor has a chat variant (broad reads + `propose_edit`) and a
 *     pipeline variant scoped to a single work unit.
 *   - Orchestrator and Verifier are pipeline-only.
 *
 * Tool ids must match registered ids in `AI_TOOLS`. The consolidated `list`
 * and `get` tools accept SCOPED ids (`list:chapter`, `get:summary`, etc.)
 * to limit which categories an agent can read — pipeline readers, for
 * example, must be denied access to the user's authored bible. Use the
 * unscoped `list` / `get` to grant all categories.
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
 * the bible and chapter content but never mutate. Pipeline-only reader
 * tools (bible_*, list_notes/list_questions) are excluded; they require
 * an active run.
 */
export const READER_CHAT_TOOLS: readonly string[] = [...CHAT_READS_BASE];

/**
 * Comprehension pass: reader sees ONE inlined chapter. Read-back tools are
 * gated by `readableChapterIds` so the agent cannot peek ahead.
 * `search_project` is excluded because the comprehension reader has no
 * access to the user's authored bible by design — the same reason
 * `list` / `get` are scoped to chapter only.
 */
export const READER_COMPREHENSION_TOOLS: readonly string[] = [
  "bible_read",
  "bible_write",
  "bible_list",
  "note",
  "question",
  "list_notes",
  "list_questions",
  "list:chapter",
  "read_chapter",
  "read_chapter_range",
  "search_chapter",
  "search_chapters",
];

/**
 * Thematic pass: comprehension toolset plus broad search so the agent can
 * enumerate every occurrence of a hypothesised motif.
 */
export const READER_THEMATIC_TOOLS: readonly string[] = [
  ...READER_COMPREHENSION_TOOLS,
  "search_project",
];

/**
 * Self-answer pass: full reconciliation toolset. Walks open questions and
 * surfaces resolutions via `propose_answer`. No `bible_write` to motifs/
 * domain (that's owned by the thematic pass).
 */
export const READER_SELF_ANSWER_TOOLS: readonly string[] = [
  "list:chapter",
  "read_chapter",
  "read_chapter_range",
  "search_chapter",
  "search_chapters",
  "search_project",
  "get_chapter_structure",
  "get:outline",
  "bible_read",
  "bible_write",
  "bible_list",
  "note",
  "question",
  "list_notes",
  "list_questions",
  "propose_answer",
];

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

/**
 * Pipeline editor: scoped to a single work unit. Read summaries / chapter
 * content / bible refs to ground the edit, then stage via `propose_edit`.
 * No bible_write — facts come from the orchestrator's bibleRefs.
 */
export const EDITOR_PIPELINE_TOOLS: readonly string[] = [
  "bible_read",
  "read_chapter",
  "read_chapter_range",
  "get:summary",
  "propose_edit",
];

// ─── Orchestrator ────────────────────────────────────────────────────

/**
 * Pipeline orchestrator: turns reader notes into a tier of work units.
 * No `propose_edit` (orchestrator never writes prose) and no `bible_write`
 * (cannot author facts; only the reader does).
 */
export const ORCHESTRATOR_TOOLS: readonly string[] = [
  "bible_read",
  "bible_list",
  "get:summary",
  "read_chapter",
  "list:chapter",
  "list_notes",
  "list_questions",
  "create_work_unit",
  "update_work_unit",
  "finalize_tier",
];

// ─── Verifier ────────────────────────────────────────────────────────

/**
 * Pipeline verifier: read-only inspection of a freshly-applied tier.
 * No write tools beyond `report_verification`; findings are routed back as
 * notes for the next planning round.
 */
export const VERIFIER_TOOLS: readonly string[] = [
  "bible_read",
  "bible_list",
  "read_chapter",
  "read_chapter_range",
  "get:summary",
  "report_verification",
];
