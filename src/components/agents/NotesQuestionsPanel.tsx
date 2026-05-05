"use client";

import { useState } from "react";
import {
  BUTTON_CANCEL,
  BUTTON_PRIMARY,
  INPUT_CLASS,
} from "@/components/ui/form-styles";
import { updateAgentNote } from "@/db/operations/agentNotes";
import {
  answerAgentQuestion,
  clearProposedAnswer,
  dismissAgentQuestion,
} from "@/db/operations/agentQuestions";
import type { AgentNote, AgentNoteSeverity, AgentQuestion } from "@/db/schemas";
import { useAgentNotes, useAgentQuestions } from "@/hooks/data/useAgentNotes";

interface NotesQuestionsPanelProps {
  runId: string;
}

export function NotesQuestionsPanel({ runId }: NotesQuestionsPanelProps) {
  const notes = useAgentNotes(runId);
  const questions = useAgentQuestions(runId);

  const [tab, setTab] = useState<"notes" | "questions">("notes");
  const openQuestionCount = (questions ?? []).filter(
    (q) => q.status === "open",
  ).length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("notes")}
          className={`rounded px-3 py-1 text-sm ${
            tab === "notes"
              ? "bg-primary-600 text-white"
              : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"
          }`}
        >
          Notes ({notes?.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setTab("questions")}
          className={`rounded px-3 py-1 text-sm ${
            tab === "questions"
              ? "bg-primary-600 text-white"
              : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"
          }`}
        >
          Questions ({questions?.length ?? 0})
          {openQuestionCount > 0 && (
            <span className="ml-1 rounded bg-amber-500 px-1.5 text-[10px] text-white">
              {openQuestionCount} open
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "notes" && <NotesList notes={notes ?? []} />}
        {tab === "questions" && <QuestionsList questions={questions ?? []} />}
      </div>
    </div>
  );
}

const SEVERITY_STYLES: Record<AgentNoteSeverity, string> = {
  blocker: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  major: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  minor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  nit: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

function NotesList({ notes }: { notes: AgentNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        No notes yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {notes.map((note) => (
        <li
          key={note.id}
          className="rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLES[note.severity]}`}
            >
              {note.severity}
            </span>
            <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {note.category}
            </span>
            {note.status !== "open" && (
              <span className="text-xs text-neutral-400">· {note.status}</span>
            )}
            <button
              type="button"
              onClick={() => updateAgentNote(note.id, { status: "dismissed" })}
              disabled={note.status !== "open"}
              className="ml-auto text-xs text-neutral-400 hover:text-neutral-600 disabled:opacity-30 dark:hover:text-neutral-200"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-2 text-neutral-900 dark:text-neutral-100">
            {note.description}
          </p>
          {note.references.length > 0 && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {note.references
                .map(
                  (r) =>
                    `${r.kind}:${r.id}${r.locator ? ` (${r.locator})` : ""}`,
                )
                .join(" · ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function QuestionsList({ questions }: { questions: AgentQuestion[] }) {
  if (questions.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        No questions yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {questions.map((q) => (
        <QuestionRow key={q.id} question={q} />
      ))}
    </ul>
  );
}

function QuestionRow({ question }: { question: AgentQuestion }) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAnswer(answer: string) {
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      await answerAgentQuestion(question.id, answer.trim());
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcceptProposal() {
    if (!question.proposedAnswer) return;
    await handleAnswer(question.proposedAnswer);
  }

  async function handleRejectProposal() {
    setSubmitting(true);
    try {
      await clearProposedAnswer(question.id);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          {question.status}
        </span>
        {question.status === "open" && (
          <button
            type="button"
            onClick={() => dismissAgentQuestion(question.id)}
            className="ml-auto text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            Dismiss
          </button>
        )}
      </div>
      <p className="mt-2 text-neutral-900 dark:text-neutral-100">
        {question.description}
      </p>
      {question.humanAnswer && (
        <p className="mt-2 rounded bg-neutral-100 p-2 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
          <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Your answer
          </span>
          <br />
          {question.humanAnswer}
        </p>
      )}
      {question.status === "open" && question.proposedAnswer && (
        <div className="mt-2 rounded border border-dashed border-primary-300 bg-primary-50/50 p-2 dark:border-primary-800 dark:bg-primary-900/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-primary-700 dark:text-primary-300">
              Proposed by reader
              {question.proposedByPassNumber !== null
                ? ` (pass ${question.proposedByPassNumber})`
                : ""}
            </span>
          </div>
          <p className="mt-1 text-neutral-900 dark:text-neutral-100">
            {question.proposedAnswer}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleRejectProposal}
              disabled={submitting}
              className={BUTTON_CANCEL}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={handleAcceptProposal}
              disabled={submitting}
              className={BUTTON_PRIMARY}
            >
              {submitting ? "Saving…" : "Accept"}
            </button>
          </div>
        </div>
      )}
      {question.status === "open" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Answer this question…"
            rows={3}
            className={`${INPUT_CLASS} mt-0`}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft("")}
              disabled={!draft || submitting}
              className={BUTTON_CANCEL}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleAnswer(draft)}
              disabled={!draft.trim() || submitting}
              className={BUTTON_PRIMARY}
            >
              {submitting ? "Saving…" : "Answer"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
