import { z } from "zod";
import {
  countAgentNotesSince,
  createAgentNote,
  listAgentNotes,
} from "@/db/operations/agentNotes";
import {
  countAgentQuestionsSince,
  createAgentQuestion,
  listAgentQuestions,
} from "@/db/operations/agentQuestions";
import {
  AgentNoteCategoryEnum,
  AgentNoteSeverityEnum,
  AgentReferenceKindEnum,
} from "@/db/schemas";
import { defineTool, type ToolResult } from "../types";

function ok(message: string, data?: Record<string, unknown>): ToolResult {
  return { success: true, message, data };
}

function fail(message: string): ToolResult {
  return { success: false, message };
}

const referenceSchema = z.object({
  kind: AgentReferenceKindEnum,
  id: z.string(),
  locator: z.string().optional(),
});
const referencesArraySchema = z.array(referenceSchema);

function parseReferences(
  raw: string | undefined,
): z.infer<typeof referencesArraySchema> | undefined | Error {
  if (raw === undefined || raw.trim() === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Error("`references` must be a JSON-encoded array");
  }
  const result = referencesArraySchema.safeParse(parsed);
  if (!result.success) {
    return new Error(
      `Invalid references: ${result.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return result.data;
}

// ─── note ────────────────────────────────────────────────────────────

export const noteTool = defineTool({
  id: "note",
  name: "Log Reader Note",
  description:
    "Record an observation about the manuscript that may need editorial attention. " +
    "Use category/severity to triage; include `references` (chapter/bible/note ids) so the orchestrator can locate the issue. " +
    "Notes are addressed by editors — they are NOT places to propose edits directly.",
  parameters: {
    type: "object",
    properties: {
      chapterId: {
        type: "string",
        description:
          "Chapter the note anchors to. Omit for cross-cutting observations.",
      },
      category: {
        type: "string",
        enum: [
          "plot",
          "character",
          "continuity",
          "voice",
          "pacing",
          "prose",
          "worldbuilding",
          "theme",
          "other",
        ],
      },
      severity: {
        type: "string",
        enum: ["blocker", "major", "minor", "nit"],
      },
      description: {
        type: "string",
        description: "What you observed and why it matters.",
      },
      references: {
        type: "string",
        description:
          "JSON-encoded array of {kind, id, locator?}. kind ∈ chapter|bible|note. " +
          'Example: \'[{"kind":"chapter","id":"<uuid>","locator":"para 12"}]\'',
      },
    },
    required: ["category", "severity", "description"],
  },
  inputSchema: z.object({
    chapterId: z.string().uuid().optional(),
    category: AgentNoteCategoryEnum,
    severity: AgentNoteSeverityEnum,
    description: z.string().min(1),
    references: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("note requires a run context");
    const refs = parseReferences(params.references);
    if (refs instanceof Error) return fail(refs.message);
    const note = await createAgentNote({
      projectId: context.projectId,
      runId: context.runId,
      chapterId: params.chapterId ?? null,
      category: params.category,
      severity: params.severity,
      description: params.description,
      references: refs,
    });
    return ok(`Logged ${params.severity} ${params.category} note`, {
      noteId: note.id,
    });
  },
});

// ─── question ───────────────────────────────────────────────────────

export const questionTool = defineTool({
  id: "question",
  name: "Surface Question to Human",
  description:
    "Surface a question that requires human judgment (e.g. is this contradiction intentional revelation or an error?). " +
    "Questions appear in the run dashboard for the user to answer; orchestrator only sees the answer once provided.",
  parameters: {
    type: "object",
    properties: {
      description: { type: "string" },
      references: {
        type: "string",
        description:
          "JSON-encoded array of {kind, id, locator?}. See `note` tool for shape.",
      },
    },
    required: ["description"],
  },
  inputSchema: z.object({
    description: z.string().min(1),
    references: z.string().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("question requires a run context");
    const refs = parseReferences(params.references);
    if (refs instanceof Error) return fail(refs.message);
    const q = await createAgentQuestion({
      projectId: context.projectId,
      runId: context.runId,
      description: params.description,
      references: refs,
    });
    return ok("Question surfaced for human review", { questionId: q.id });
  },
});

// ─── list_notes ─────────────────────────────────────────────────────

export const listNotesTool = defineTool({
  id: "list_notes",
  name: "List Reader Notes",
  description:
    "List notes for the current run. Filter by status (open/addressed/dismissed) and/or chapter.",
  parameters: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["open", "addressed", "dismissed"],
      },
      chapterId: { type: "string" },
    },
  },
  inputSchema: z.object({
    status: z.enum(["open", "addressed", "dismissed"]).optional(),
    chapterId: z.string().uuid().optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("list_notes requires a run context");
    const notes = await listAgentNotes({
      runId: context.runId,
      status: params.status,
      chapterId: params.chapterId,
    });
    return ok(`Found ${notes.length} notes`, {
      notes: notes.map((n) => ({
        id: n.id,
        chapterId: n.chapterId,
        category: n.category,
        severity: n.severity,
        description: n.description,
        status: n.status,
        references: n.references,
      })),
    });
  },
});

// ─── list_questions ─────────────────────────────────────────────────

export const listQuestionsTool = defineTool({
  id: "list_questions",
  name: "List Reader Questions",
  description:
    "List questions for the current run. Filter by status (open/answered/dismissed).",
  parameters: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["open", "answered", "dismissed"] },
    },
  },
  inputSchema: z.object({
    status: z.enum(["open", "answered", "dismissed"]).optional(),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("list_questions requires a run context");
    const questions = await listAgentQuestions({
      runId: context.runId,
      status: params.status,
    });
    return ok(`Found ${questions.length} questions`, {
      questions: questions.map((q) => ({
        id: q.id,
        description: q.description,
        status: q.status,
        humanAnswer: q.humanAnswer,
      })),
    });
  },
});

// Re-export for the readerLoop to compute deltas without round-tripping
// through the model.
export { countAgentNotesSince, countAgentQuestionsSince };
