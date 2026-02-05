"use client";

import { Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RoleBadge } from "@/components/bible/RoleBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createCharacter, deleteCharacter } from "@/db/operations";
import type { CharacterRole } from "@/db/schemas";
import {
  useCharactersByProject,
  useRelationshipsByProject,
} from "@/hooks/useBibleEntries";

const roleBorderColors: Record<CharacterRole, string> = {
  protagonist: "border-l-amber-400 dark:border-l-amber-500",
  antagonist: "border-l-red-400 dark:border-l-red-500",
  supporting: "border-l-blue-400 dark:border-l-blue-500",
  minor: "border-l-zinc-300 dark:border-l-zinc-600",
};

type RoleFilter = "all" | CharacterRole;

const filterTabs: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "protagonist", label: "Protagonist" },
  { value: "antagonist", label: "Antagonist" },
  { value: "supporting", label: "Supporting" },
  { value: "minor", label: "Minor" },
];

export default function CharacterListPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const characters = useCharactersByProject(params.projectId);
  const relationships = useRelationshipsByProject(params.projectId);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!characters) return [];
    if (filter === "all") return characters;
    return characters.filter((c) => c.role === filter);
  }, [characters, filter]);

  async function handleCreate() {
    const character = await createCharacter({
      projectId: params.projectId,
      name: "New Character",
    });
    router.push(
      `/projects/${params.projectId}/bible/characters/${character.id}`,
    );
  }

  function getRelationshipCount(charId: string) {
    if (!relationships) return 0;
    return relationships.filter(
      (r) => r.sourceCharacterId === charId || r.targetCharacterId === charId,
    ).length;
  }

  const deletingCharacter = characters?.find((c) => c.id === deletingId);

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

      {/* Role filter tabs */}
      <div className="mt-5 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-zinc-400 dark:text-zinc-500">
            <Users size={40} strokeWidth={1.5} />
            <p className="text-sm">
              {filter === "all"
                ? "No characters yet. Add one to get started."
                : `No ${filter} characters.`}
            </p>
          </div>
        )}
        {filtered.map((character) => {
          const aliases = character.aliases ?? [];
          const relCount = getRelationshipCount(character.id);
          const linkedLocCount = (character.linkedLocationIds ?? []).length;

          return (
            <div
              key={character.id}
              className={`flex items-start justify-between gap-4 rounded-lg border border-l-4 border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900 ${roleBorderColors[character.role]}`}
            >
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/projects/${params.projectId}/bible/characters/${character.id}`,
                  )
                }
                className="flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {character.name}
                  </h3>
                  <RoleBadge role={character.role} />
                  {character.pronouns && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {character.pronouns}
                    </span>
                  )}
                </div>
                {character.description && (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500 line-clamp-2 dark:text-zinc-400">
                    {character.description}
                  </p>
                )}
                {(aliases.length > 0 || relCount > 0 || linkedLocCount > 0) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aliases.length > 0 && (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {aliases.length} alias{aliases.length !== 1 && "es"}
                      </span>
                    )}
                    {relCount > 0 && (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {relCount} relationship{relCount !== 1 && "s"}
                      </span>
                    )}
                    {linkedLocCount > 0 && (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {linkedLocCount} location{linkedLocCount !== 1 && "s"}
                      </span>
                    )}
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(character.id)}
                className="mt-0.5 shrink-0 text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500"
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>

      {deletingId && deletingCharacter && (
        <ConfirmDialog
          title="Delete Character"
          message={
            <>
              Are you sure you want to delete{" "}
              <strong>{deletingCharacter.name}</strong>? This action cannot be
              undone.
            </>
          }
          variant="danger"
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteCharacter(deletingId);
            setDeletingId(null);
          }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
