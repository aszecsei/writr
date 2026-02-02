"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { deleteCharacter, updateCharacter } from "@/db/operations";
import type { CharacterRole } from "@/db/schemas";
import { useCharacter } from "@/hooks/useBibleEntries";
import { useCharacterForm } from "@/hooks/useCharacterForm";

export default function CharacterDetailPage() {
  const params = useParams<{ projectId: string; characterId: string }>();
  const router = useRouter();
  const character = useCharacter(params.characterId);
  const { form, setField, isDirty, getUpdatePayload } =
    useCharacterForm(character);

  if (!character) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await updateCharacter(params.characterId, getUpdatePayload());
  }

  async function handleDelete() {
    await deleteCharacter(params.characterId);
    router.push(`/projects/${params.projectId}/bible/characters`);
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
  const labelClass =
    "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${params.projectId}/bible/characters`}
              className="rounded-md p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronLeft size={20} />
            </Link>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="text-2xl font-bold text-zinc-900 bg-transparent border-none outline-none dark:text-zinc-100"
              placeholder="Character Name"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Delete
            </button>
            <button
              type="submit"
              disabled={!isDirty}
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save
            </button>
          </div>
        </div>

        {/* Identity row */}
        <div className="grid grid-cols-3 gap-4">
          <label className={labelClass}>
            Role
            <select
              value={form.role}
              onChange={(e) =>
                setField("role", e.target.value as CharacterRole)
              }
              className={inputClass}
            >
              <option value="protagonist">Protagonist</option>
              <option value="antagonist">Antagonist</option>
              <option value="supporting">Supporting</option>
              <option value="minor">Minor</option>
            </select>
          </label>
          <label className={labelClass}>
            Pronouns
            <input
              type="text"
              value={form.pronouns}
              onChange={(e) => setField("pronouns", e.target.value)}
              className={inputClass}
              placeholder="she/her, he/him, they/them..."
            />
          </label>
          <label className={labelClass}>
            Aliases
            <input
              type="text"
              value={form.aliasesInput}
              onChange={(e) => setField("aliasesInput", e.target.value)}
              className={inputClass}
              placeholder="comma-separated"
            />
          </label>
        </div>

        {/* Physical Description */}
        <label className={labelClass}>
          Physical Description
          <textarea
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Appearance, distinguishing features, mannerisms..."
          />
        </label>

        {/* Personality & Motivations */}
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Personality
            <textarea
              value={form.personality}
              onChange={(e) => setField("personality", e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Temperament, habits, social behavior..."
            />
          </label>
          <label className={labelClass}>
            Motivations
            <textarea
              value={form.motivations}
              onChange={(e) => setField("motivations", e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Goals, desires, what drives them..."
            />
          </label>
        </div>

        {/* Internal Conflict */}
        <label className={labelClass}>
          Internal Conflict
          <textarea
            value={form.internalConflict}
            onChange={(e) => setField("internalConflict", e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Inner struggles, contradictions, moral dilemmas..."
          />
        </label>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Strengths
            <textarea
              value={form.strengths}
              onChange={(e) => setField("strengths", e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Skills, virtues, advantages..."
            />
          </label>
          <label className={labelClass}>
            Weaknesses
            <textarea
              value={form.weaknesses}
              onChange={(e) => setField("weaknesses", e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Flaws, vulnerabilities, blind spots..."
            />
          </label>
        </div>

        {/* Character Arcs & Dialogue Style */}
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Character Arcs
            <textarea
              value={form.characterArcs}
              onChange={(e) => setField("characterArcs", e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Growth, transformation, key turning points..."
            />
          </label>
          <label className={labelClass}>
            Dialogue Style
            <textarea
              value={form.dialogueStyle}
              onChange={(e) => setField("dialogueStyle", e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Speech patterns, vocabulary, verbal tics..."
            />
          </label>
        </div>

        {/* Backstory */}
        <label className={labelClass}>
          Backstory
          <textarea
            value={form.backstory}
            onChange={(e) => setField("backstory", e.target.value)}
            rows={5}
            className={inputClass}
            placeholder="Character history and background..."
          />
        </label>

        {/* Notes */}
        <label className={labelClass}>
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            rows={4}
            className={inputClass}
            placeholder="Freeform notes..."
          />
        </label>
      </form>
    </div>
  );
}
