import {
  createChapterTool,
  getChapterStructureTool,
  readChapterRangeTool,
  readChapterTool,
  searchChaptersTool,
  searchChapterTool,
  updateChapterTool,
} from "./tools/chapters";
import {
  createCharacterTool,
  deleteCharacterTool,
  updateCharacterTool,
} from "./tools/characters";
import { addCommentTool, replyToCommentTool } from "./tools/comments";
import { delegateTool } from "./tools/delegate";
import { fail, formatZodError } from "./tools/helpers";
import {
  createLocationTool,
  deleteLocationTool,
  updateLocationTool,
} from "./tools/locations";
import {
  manageOutlineColumnsTool,
  manageOutlineRowsTool,
  setOutlineCellColorTool,
  writeOutlineCellTool,
} from "./tools/outline";
import { presentChoiceTool } from "./tools/presentChoice";
import { proposeEditTool } from "./tools/proposedEdits";
import { getTool, listTool } from "./tools/registry";
import { listScenesTool, updateSceneTool } from "./tools/scenes";
import { searchProjectTool } from "./tools/search";
import {
  createTimelineEventTool,
  deleteTimelineEventTool,
  moveTimelineEventTool,
  updateTimelineEventTool,
} from "./tools/timeline";
import {
  createWorldbuildingDocTool,
  deleteWorldbuildingDocTool,
  moveWorldbuildingDocTool,
  updateWorldbuildingDocTool,
} from "./tools/worldbuilding";
import type {
  AiToolDefinition,
  ToolExecutionContext,
  ToolResult,
} from "./types";

export const AI_TOOLS: AiToolDefinition[] = [
  // Consolidated read surface
  listTool,
  getTool,
  // Story bible CRUD
  createCharacterTool,
  updateCharacterTool,
  deleteCharacterTool,
  createLocationTool,
  updateLocationTool,
  deleteLocationTool,
  createTimelineEventTool,
  updateTimelineEventTool,
  deleteTimelineEventTool,
  moveTimelineEventTool,
  // Worldbuilding CRUD + move
  createWorldbuildingDocTool,
  updateWorldbuildingDocTool,
  deleteWorldbuildingDocTool,
  moveWorldbuildingDocTool,
  // Chapter CRUD + content reads
  createChapterTool,
  updateChapterTool,
  readChapterTool,
  readChapterRangeTool,
  searchChapterTool,
  searchChaptersTool,
  getChapterStructureTool,
  // Scene metadata: read (per chapter) + write
  listScenesTool,
  updateSceneTool,
  // Project-wide search
  searchProjectTool,
  // Editor: stage a developmental edit for the user to apply
  proposeEditTool,
  // Beta Reader: inline editor comments + threaded replies
  addCommentTool,
  replyToCommentTool,
  // Outline Architect: grid management
  manageOutlineColumnsTool,
  manageOutlineRowsTool,
  writeOutlineCellTool,
  setOutlineCellColorTool,
  // Orchestration: sub-agent delegation + user prompts
  delegateTool,
  presentChoiceTool,
];

export const AI_TOOL_MAP = new Map<string, AiToolDefinition>(
  AI_TOOLS.map((t) => [t.id, t]),
);

export async function executeTool(
  toolId: string,
  params: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const tool = AI_TOOL_MAP.get(toolId);
  if (!tool) return fail(`Unknown tool: ${toolId}`);

  const parsed = tool.inputSchema.safeParse(params);
  if (!parsed.success)
    return fail(`Invalid parameters: ${formatZodError(parsed.error)}`);

  try {
    return await tool.execute(parsed.data as Record<string, unknown>, context);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Tool execution failed",
    );
  }
}
