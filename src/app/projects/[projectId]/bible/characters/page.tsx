"use client";

import { useParams, useRouter } from "next/navigation";
import { createCharacter, deleteCharacter } from "@/db/operations";
import { useCharactersByProject } from "@/hooks/useBibleEntries";

export default function CharacterListPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const characters = useCharactersByProject(params.projectId);

  async function handleCreate() {
    const character = await createCharacter({
      projectId: params.projectId,
      name: "New Character",
    });
    router.push(
      `/projects/${params.projectId}/bible/characters/${character.id}`,
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Characters
        </h2>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add Character
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {characters?.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No characters yet.
          </p>
        )}
        {characters?.map((character) => (
          <div
            key={character.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/projects/${params.projectId}/bible/characters/${character.id}`,
                )
              }
              className="text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {character.name}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {character.role}
              </p>
            </button>
            <button
              type="button"
              onClick={() => deleteCharacter(character.id)}
              className="text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
