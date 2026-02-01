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
  const [description, setDescription] = useState("");
  const [backstory, setBackstory] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (character) {
      setName(character.name);
      setRole(character.role);
      setDescription(character.description);
      setBackstory(character.backstory);
      setNotes(character.notes);
    }
  }, [character]);

  if (!character) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await updateCharacter(params.characterId, {
      name,
      role,
      description,
      backstory,
      notes,
    });
  }

  async function handleDelete() {
    await deleteCharacter(params.characterId);
    router.push(`/projects/${params.projectId}/bible/characters`);
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <form onSubmit={handleSave} className="space-y-6">
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
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CharacterRole)}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="protagonist">Protagonist</option>
              <option value="antagonist">Antagonist</option>
              <option value="supporting">Supporting</option>
              <option value="minor">Minor</option>
            </select>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Physical appearance, personality traits..."
            />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Backstory
            <textarea
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              rows={6}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Character history and background..."
            />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Freeform notes..."
            />
          </label>
        </div>
      </form>
    </div>
  );
}
