import { z } from "zod";
import {
  countAgentNotesSince,
  createAgentNote,
  listAgentNotes,
} from "@/db/operations/agentNotes";
import {
  countAgentQuestionsSince,
  createAgentQuestion,
  getAgentQuestion,
  listAgentQuestions,
  proposeAgentQuestionAnswer,
} from "@/db/operations/agentQuestions";
import {
  AgentNoteCategoryEnum,
  AgentNoteSeverityEnum,
  type AgentQuestionId,
  AgentReferenceKindEnum,
  type ChapterId,
} from "@/db/schemas";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

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
  category: "note",
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
      chapterId: (params.chapterId ?? null) as ChapterId | null,
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
  category: "note",
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
  category: "note",
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
      chapterId: params.chapterId as ChapterId | undefined,
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
  category: "note",
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
        proposedAnswer: q.proposedAnswer,
        proposedAt: q.proposedAt,
        proposedByPassNumber: q.proposedByPassNumber,
      })),
    });
  },
});

// ─── propose_answer ─────────────────────────────────────────────────

export const proposeAnswerTool = defineTool({
  id: "propose_answer",
  category: "note",
  name: "Propose Answer to Question",
  description:
    "Record a proposed resolution for an open question, based on what the manuscript shows. " +
    "The question stays `open` until a human ratifies the proposal — agents are advisory. " +
    "Use this only after re-reading the relevant chapters and writing supporting `note`s / `bible_write`s.",
  parameters: {
    type: "object",
    properties: {
      questionId: {
        type: "string",
        description:
          'Id of the question to propose an answer for. Use `list_questions(status="open")` to find candidates.',
      },
      proposedAnswer: {
        type: "string",
        description:
          "Concise resolution grounded in textual evidence. Cite chapters/quotes inline.",
      },
    },
    required: ["questionId", "proposedAnswer"],
  },
  inputSchema: z.object({
    questionId: z.string().uuid(),
    proposedAnswer: z.string().min(1),
  }),
  requiresApproval: false,
  async execute(params, context) {
    if (!context.runId) return fail("propose_answer requires a run context");
    if (context.passNumber === undefined) {
      return fail("propose_answer requires a pass number on the agent context");
    }
    const question = await getAgentQuestion(
      params.questionId as AgentQuestionId,
    );
    if (!question) return fail(`Question not found: ${params.questionId}`);
    if (question.runId !== context.runId) {
      return fail("Question belongs to a different run");
    }
    if (question.status !== "open") {
      return fail(`Cannot propose an answer for a ${question.status} question`);
    }
    await proposeAgentQuestionAnswer({
      id: params.questionId as AgentQuestionId,
      proposedAnswer: params.proposedAnswer,
      passNumber: context.passNumber,
    });
    return ok("Recorded proposed answer for human review", {
      questionId: params.questionId,
    });
  },
});

// Re-export for the readerLoop to compute deltas without round-tripping
// through the model.
export { countAgentNotesSince, countAgentQuestionsSince };
