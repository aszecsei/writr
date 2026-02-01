"use client";

import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { deleteCharacter, updateCharacter } from "@/db/operations";
import type { CharacterRole } from "@/db/schemas";
import { useCharacter } from "@/hooks/useBibleEntries";

export default function CharacterDetailPage() {
  const params = useParams<{ projectId: string; characterId: string }>();
  const router = useRouter();
  const character = useCharacter(params.characterId);

  const [name, setName] = useState("");
  const [role, setRole] = useState<CharacterRole>("supporting");
  const [pronouns, setPronouns] = useState("");
  const [aliasesInput, setAliasesInput] = useState("");
  const [description, setDescription] = useState("");
  const [personality, setPersonality] = useState("");
  const [motivations, setMotivations] = useState("");
  const [internalConflict, setInternalConflict] = useState("");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [characterArcs, setCharacterArcs] = useState("");
  const [dialogueStyle, setDialogueStyle] = useState("");
  const [backstory, setBackstory] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (character) {
      setName(character.name);
      setRole(character.role);
      setPronouns(character.pronouns ?? "");
      setAliasesInput((character.aliases ?? []).join(", "));
      setDescription(character.description ?? "");
      setPersonality(character.personality ?? "");
      setMotivations(character.motivations ?? "");
      setInternalConflict(character.internalConflict ?? "");
      setStrengths(character.strengths ?? "");
      setWeaknesses(character.weaknesses ?? "");
      setCharacterArcs(character.characterArcs ?? "");
      setDialogueStyle(character.dialogueStyle ?? "");
      setBackstory(character.backstory ?? "");
      setNotes(character.notes ?? "");
    }
  }, [character]);

  if (!character) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const aliases = aliasesInput
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    await updateCharacter(params.characterId, {
      name,
      role,
      pronouns,
      aliases,
      description,
      personality,
      motivations,
      internalConflict,
      strengths,
      weaknesses,
      characterArcs,
      dialogueStyle,
      backstory,
      notes,
    });
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
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-2xl font-bold text-zinc-900 bg-transparent border-none outline-none dark:text-zinc-100"
            placeholder="Character Name"
          />
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
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
              value={role}
              onChange={(e) => setRole(e.target.value as CharacterRole)}
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
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              className={inputClass}
              placeholder="she/her, he/him, they/them..."
            />
          </label>
          <label className={labelClass}>
            Aliases
            <input
              type="text"
              value={aliasesInput}
              onChange={(e) => setAliasesInput(e.target.value)}
              className={inputClass}
              placeholder="comma-separated"
            />
          </label>
        </div>

        {/* Physical Description */}
        <label className={labelClass}>
          Physical Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Temperament, habits, social behavior..."
            />
          </label>
          <label className={labelClass}>
            Motivations
            <textarea
              value={motivations}
              onChange={(e) => setMotivations(e.target.value)}
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
            value={internalConflict}
            onChange={(e) => setInternalConflict(e.target.value)}
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
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Skills, virtues, advantages..."
            />
          </label>
          <label className={labelClass}>
            Weaknesses
            <textarea
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
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
              value={characterArcs}
              onChange={(e) => setCharacterArcs(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Growth, transformation, key turning points..."
            />
          </label>
          <label className={labelClass}>
            Dialogue Style
            <textarea
              value={dialogueStyle}
              onChange={(e) => setDialogueStyle(e.target.value)}
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
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            rows={5}
            className={inputClass}
            placeholder="Character history and background..."
          />
        </label>

        {/* Notes */}
        <label className={labelClass}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={inputClass}
            placeholder="Freeform notes..."
          />
        </label>
      </form>
    </div>
  );
}
