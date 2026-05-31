import { bibleListTool, bibleReadTool, bibleWriteTool } from "./tools/bible";
import {
  createChapterTool,
  getChapterStructureTool,
  readChapterRangeTool,
  readChapterTool,
  searchChaptersTool,
  searchChapterTool,
  updateChapterTool,
} from "./tools/chapters";
import { createCharacterTool, updateCharacterTool } from "./tools/characters";
import { addCommentTool, replyToCommentTool } from "./tools/comments";
import { fail, formatZodError } from "./tools/helpers";
import { createLocationTool, updateLocationTool } from "./tools/locations";
import {
  listNotesTool,
  listQuestionsTool,
  noteTool,
  proposeAnswerTool,
  questionTool,
} from "./tools/notes";
import {
  manageOutlineColumnsTool,
  manageOutlineRowsTool,
  setOutlineCellColorTool,
  writeOutlineCellTool,
} from "./tools/outline";
import { proposeEditTool } from "./tools/proposedEdits";
import { getTool, listTool } from "./tools/registry";
import { searchProjectTool } from "./tools/search";
import {
  createTimelineEventTool,
  updateTimelineEventTool,
} from "./tools/timeline";
import { reportVerificationTool } from "./tools/verification";
import {
  createWorkUnitTool,
  finalizeTierTool,
  updateWorkUnitTool,
} from "./tools/workUnits";
import type {
  AiToolDefinition,
  ToolDefinitionForModel,
  ToolExecutionContext,
  ToolResult,
} from "./types";

export const AI_TOOLS: AiToolDefinition[] = [
  // Consolidated read surface (replaces list_*/get_* per-entity tools)
  listTool,
  getTool,
  // Story bible CRUD
  createCharacterTool,
  updateCharacterTool,
  createLocationTool,
  updateLocationTool,
  createTimelineEventTool,
  updateTimelineEventTool,
  // Chapter CRUD + content reads
  createChapterTool,
  updateChapterTool,
  readChapterTool,
  readChapterRangeTool,
  searchChapterTool,
  searchChaptersTool,
  getChapterStructureTool,
  // Project-wide search
  searchProjectTool,
  // Pipeline reader bible + notes/questions
  bibleReadTool,
  bibleWriteTool,
  bibleListTool,
  noteTool,
  questionTool,
  listNotesTool,
  listQuestionsTool,
  proposeAnswerTool,
  // Pipeline orchestrator + editor
  createWorkUnitTool,
  updateWorkUnitTool,
  finalizeTierTool,
  proposeEditTool,
  // Pipeline verifier
  reportVerificationTool,
  // Beta Reader: inline editor comments + threaded replies
  addCommentTool,
  replyToCommentTool,
  // Outline Architect: grid management
  manageOutlineColumnsTool,
  manageOutlineRowsTool,
  writeOutlineCellTool,
  setOutlineCellColorTool,
];

export const AI_TOOL_MAP = new Map<string, AiToolDefinition>(
  AI_TOOLS.map((t) => [t.id, t]),
);

export function getToolDefinitionsForModel(): ToolDefinitionForModel[] {
  return AI_TOOLS.map(({ id, name, description, parameters }) => ({
    id,
    name,
    description,
    parameters,
  }));
}

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
