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
} from "@/hooks/data/useBibleEntries";

const roleBorderColors: Record<CharacterRole, string> = {
  protagonist: "border-l-amber-400 dark:border-l-amber-500",
  antagonist: "border-l-red-400 dark:border-l-red-500",
  supporting: "border-l-blue-400 dark:border-l-blue-500",
  minor: "border-l-neutral-300 dark:border-l-neutral-600",
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
    <div className="mx-auto max-w-editor px-8 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Characters
        </h2>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
        >
          Add Character
        </button>
      </div>

      {/* Role filter tabs */}
      <div className="mt-5 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "border-b-2 border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-neutral-400 dark:text-neutral-500">
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
          const primaryImage = (character.images ?? []).find(
            (img) => img.isPrimary,
          );

          return (
            <div
              key={character.id}
              className={`flex items-start justify-between gap-4 rounded-lg border border-l-4 border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900 ${roleBorderColors[character.role]}`}
            >
              {primaryImage && (
                // biome-ignore lint/performance/noImgElement: external URLs
                <img
                  src={primaryImage.url}
                  alt={character.name}
                  className="h-12 w-12 shrink-0 rounded-md object-cover"
                />
              )}
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
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {character.name}
                  </h3>
                  <RoleBadge role={character.role} />
                  {character.pronouns && (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {character.pronouns}
                    </span>
                  )}
                </div>
                {character.description && (
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500 line-clamp-2 dark:text-neutral-400">
                    {character.description}
                  </p>
                )}
                {(aliases.length > 0 || relCount > 0 || linkedLocCount > 0) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aliases.length > 0 && (
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        {aliases.length} alias{aliases.length !== 1 && "es"}
                      </span>
                    )}
                    {relCount > 0 && (
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        {relCount} relationship{relCount !== 1 && "s"}
                      </span>
                    )}
                    {linkedLocCount > 0 && (
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                        {linkedLocCount} location{linkedLocCount !== 1 && "s"}
                      </span>
                    )}
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(character.id)}
                className="mt-0.5 shrink-0 text-xs text-neutral-400 hover:text-red-500 dark:text-neutral-500"
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
