/**
 * Single inventory of which tools each agent variant may invoke.
 *
 * Agent kinds map to multiple variants when an agent is invoked under
 * different operating contexts:
 *   - Reader has a chat variant (no tools by default) and three pipeline
 *     modes (comprehension / thematic / self-answer).
 *   - Editor has a chat variant (only `propose_edit`) and a pipeline variant
 *     scoped to a single work unit.
 *   - Orchestrator and Verifier are pipeline-only.
 *
 * Tool ids must match registered ids in `AI_TOOLS`. The consolidated `list`
 * and `get` tools accept SCOPED ids (`list:chapter`, `get:summary`, etc.)
 * to limit which categories an agent can read — pipeline readers, for
 * example, must be denied access to the user's authored bible. Use the
 * unscoped `list` / `get` to grant all categories.
 */

// ─── Reader ──────────────────────────────────────────────────────────

/** Chat-mode reader: text-only by default (no tool calls). */
export const READER_CHAT_TOOLS: readonly string[] = [];

/**
 * Comprehension pass: reader sees ONE inlined chapter. Read-back tools are
 * gated by `maxReadableChapterOrder` so the agent cannot peek ahead.
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
 * Chat-mode editor: only `propose_edit`. The model writes prose inline;
 * staging-via-tool is opt-in for "rewrite this" requests.
 */
export const EDITOR_CHAT_TOOLS: readonly string[] = ["propose_edit"];

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
