/**
 * Configuration for the AgentEditor allowed-tools picker.
 *
 * Read tools are presented as a hierarchical "Reads" section with a master
 * toggle that flips every read on or off. Each row represents one or more
 * tool ids — checking a row adds the full set, unchecking removes it.
 *
 * Mutation tools stay flat: one checkbox per tool, grouped by entity for
 * scannability.
 */

import { AI_TOOL_MAP } from "@/lib/ai/tool-calling";

/** A single row in the picker. Toggles a non-empty set of tool ids together. */
export interface ToolPickerRow {
  /** Stable key — usually the first id, but explicit so synthetic rows work. */
  key: string;
  /** Display label shown next to the checkbox. */
  label: string;
  /** Tool ids this row toggles. Order is preserved in `allowedToolIds`. */
  ids: readonly string[];
  /** Optional one-line hint shown beneath the label. */
  hint?: string;
}

/** A subgroup of rows under a section heading. */
export interface ToolPickerGroup {
  heading: string;
  rows: ToolPickerRow[];
}

// ─── Reads ─────────────────────────────────────────────────────────────

export const READS_GROUPS: ToolPickerGroup[] = [
  {
    heading: "Story bible",
    rows: [
      {
        key: "read:character",
        label: "Characters",
        ids: ["list:character", "get:character"],
      },
      {
        key: "read:location",
        label: "Locations",
        ids: ["list:location", "get:location"],
      },
      {
        key: "read:timeline",
        label: "Timeline events",
        ids: ["list:timeline", "get:timeline"],
      },
      {
        key: "read:style_guide",
        label: "Style guide",
        ids: ["list:style_guide", "get:style_guide"],
      },
      {
        key: "read:guardrail",
        label: "Guardrails",
        ids: ["list:guardrail", "get:guardrail"],
      },
      {
        key: "read:worldbuilding",
        label: "Worldbuilding",
        ids: ["list:worldbuilding", "get:worldbuilding"],
      },
    ],
  },
  {
    heading: "Chapters",
    rows: [
      {
        key: "read:chapter_meta",
        label: "Chapter metadata",
        ids: ["list:chapter", "get:chapter"],
      },
      {
        key: "read:chapter_content",
        label: "Chapter content",
        hint: "read_chapter, read_chapter_range, search_chapter, get_chapter_structure",
        ids: [
          "read_chapter",
          "read_chapter_range",
          "search_chapter",
          "get_chapter_structure",
        ],
      },
      {
        key: "read:chapter_search",
        label: "Chapter search (project-wide)",
        ids: ["search_chapters"],
      },
      {
        key: "read:scene",
        label: "Scene metadata",
        hint: "list_scenes — per-scene POV, characters, locations, tags",
        ids: ["list_scenes"],
      },
      {
        key: "read:summary",
        label: "Chapter summary",
        ids: ["get:summary"],
      },
    ],
  },
  {
    heading: "Other",
    rows: [
      {
        key: "read:outline",
        label: "Outline grid",
        ids: ["get:outline"],
      },
      {
        key: "read:search_project",
        label: "Project-wide search",
        hint: "search_project across all entity types",
        ids: ["search_project"],
      },
    ],
  },
];

/** Every read-tool id surfaced by the picker. Used by the master toggle. */
export const ALL_READ_TOOL_IDS: readonly string[] = READS_GROUPS.flatMap((g) =>
  g.rows.flatMap((r) => r.ids),
);

// ─── Mutations ─────────────────────────────────────────────────────────

export const MUTATIONS_GROUPS: ToolPickerGroup[] = [
  {
    heading: "Story bible",
    rows: [
      mutationRow("create_character"),
      mutationRow("update_character"),
      mutationRow("delete_character"),
      mutationRow("create_location"),
      mutationRow("update_location"),
      mutationRow("delete_location"),
      mutationRow("create_timeline_event"),
      mutationRow("update_timeline_event"),
      mutationRow("delete_timeline_event"),
      mutationRow("move_timeline_event"),
    ],
  },
  {
    heading: "Worldbuilding",
    rows: [
      mutationRow("create_worldbuilding_doc"),
      mutationRow("update_worldbuilding_doc"),
      mutationRow("delete_worldbuilding_doc"),
      mutationRow("move_worldbuilding_doc"),
    ],
  },
  {
    heading: "Chapters",
    rows: [
      mutationRow("create_chapter"),
      mutationRow("update_chapter"),
      mutationRow("update_scene"),
    ],
  },
  {
    heading: "Outline grid",
    rows: [
      mutationRow("manage_outline_columns"),
      mutationRow("manage_outline_rows"),
      mutationRow("write_outline_cell"),
      mutationRow("set_outline_cell_color"),
    ],
  },
  {
    heading: "Edits",
    rows: [mutationRow("propose_edit")],
  },
  {
    heading: "Orchestration",
    rows: [mutationRow("delegate"), mutationRow("present_choice")],
  },
];

function mutationRow(id: string): ToolPickerRow {
  const def = AI_TOOL_MAP.get(id);
  return {
    key: id,
    label: id,
    ids: [id],
    hint: def?.description,
  };
}

// ─── State helpers ─────────────────────────────────────────────────────

export type RowState = "off" | "on" | "partial";

/** Compute a row's state from the agent's allowedToolIds set. */
export function rowState(
  row: ToolPickerRow,
  allowed: ReadonlySet<string>,
): RowState {
  let onCount = 0;
  for (const id of row.ids) if (allowed.has(id)) onCount++;
  if (onCount === 0) return "off";
  if (onCount === row.ids.length) return "on";
  return "partial";
}

/**
 * Produce the next set after toggling a row. Standard "select all" semantics:
 * "off" or "partial" → add all ids; "on" → remove all ids.
 */
export function toggleRow(
  row: ToolPickerRow,
  allowed: ReadonlySet<string>,
): Set<string> {
  const next = new Set(allowed);
  const state = rowState(row, allowed);
  if (state === "on") {
    for (const id of row.ids) next.delete(id);
  } else {
    for (const id of row.ids) next.add(id);
  }
  return next;
}

/** Compute the master Reads-toggle state from current selections. */
export function readsMasterState(allowed: ReadonlySet<string>): RowState {
  let onCount = 0;
  for (const id of ALL_READ_TOOL_IDS) if (allowed.has(id)) onCount++;
  if (onCount === 0) return "off";
  if (onCount === ALL_READ_TOOL_IDS.length) return "on";
  return "partial";
}

/** Toggle every read tool on or off. */
export function toggleAllReads(allowed: ReadonlySet<string>): Set<string> {
  const next = new Set(allowed);
  const state = readsMasterState(allowed);
  if (state === "on") {
    for (const id of ALL_READ_TOOL_IDS) next.delete(id);
  } else {
    for (const id of ALL_READ_TOOL_IDS) next.add(id);
  }
  return next;
}
