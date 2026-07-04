"use client";

import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RoleBadge } from "@/components/bible/RoleBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createCharacter, deleteCharacter } from "@/db/operations";
import type { CharacterId, CharacterRole, ProjectId } from "@/db/schemas";
import {
  useCharactersByProject,
  useRelationshipsByProject,
} from "@/hooks/data/source";
import { getInitials } from "@/lib/characters/initials";

const roleTopColors: Record<CharacterRole, string> = {
  protagonist: "border-t-amber-400 dark:border-t-amber-500",
  antagonist: "border-t-red-400 dark:border-t-red-500",
  supporting: "border-t-blue-400 dark:border-t-blue-500",
  minor: "border-t-neutral-300 dark:border-t-neutral-600",
};

type RoleFilter = "all" | CharacterRole;

const filterTabs: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "protagonist", label: "Protagonist" },
  { value: "antagonist", label: "Antagonist" },
  { value: "supporting", label: "Supporting" },
  { value: "minor", label: "Minor" },
];

export interface CharactersPageBodyProps {
  /** Real project id (or the host's project id when rendering from a shared session). */
  projectId: ProjectId;
  /** URL prefix without trailing slash. E.g. `/projects/abc` or
   *  `/shared/room/projects/abc`. Detail-page links append the rest. */
  basePath: string;
  /** When true, hide create / delete affordances. */
  readOnly: boolean;
}

export function CharactersPageBody({
  projectId,
  basePath,
  readOnly,
}: CharactersPageBodyProps) {
  const router = useRouter();
  const characters = useCharactersByProject(projectId);
  const relationships = useRelationshipsByProject(projectId);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [deletingId, setDeletingId] = useState<CharacterId | null>(null);

  const filtered = useMemo(() => {
    if (!characters) return [];
    if (filter === "all") return characters;
    return characters.filter((c) => c.role === filter);
  }, [characters, filter]);

  async function handleCreate() {
    const character = await createCharacter({
      projectId,
      name: "New Character",
    });
    router.push(`${basePath}/bible/characters/${character.id}`);
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
        {!readOnly && (
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
          >
            Add Character
          </button>
        )}
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

      {filtered.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-3 py-16 text-neutral-400 dark:text-neutral-500">
          <Users size={40} strokeWidth={1.5} />
          <p className="text-sm">
            {filter === "all"
              ? readOnly
                ? "No characters in this project."
                : "No characters yet. Add one to get started."
              : `No ${filter} characters.`}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((character) => {
            const aliases = character.aliases ?? [];
            const relCount = getRelationshipCount(character.id);
            const linkedLocCount = (character.linkedLocationIds ?? []).length;
            const primaryImage = (character.images ?? []).find(
              (img) => img.isPrimary,
            );
            const initials = getInitials(character.name);

            return (
              <div
                key={character.id}
                className={`group relative flex flex-col overflow-hidden rounded-lg border border-t-4 border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${roleTopColors[character.role]}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    router.push(`${basePath}/bible/characters/${character.id}`)
                  }
                  className="flex flex-1 flex-col text-left"
                >
                  <div className="aspect-[4/3] w-full">
                    {primaryImage ? (
                      // biome-ignore lint/performance/noImgElement: external URLs
                      <img
                        src={primaryImage.url}
                        alt={character.name}
                        className="h-full w-full object-cover"
                        style={{
                          objectPosition: `${(primaryImage.focalX ?? 0.5) * 100}% ${(primaryImage.focalY ?? 0) * 100}%`,
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                        {initials ? (
                          <span className="text-3xl font-semibold">
                            {initials}
                          </span>
                        ) : (
                          <Users size={40} strokeWidth={1.5} />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex flex-wrap items-center gap-2">
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
                    {(aliases.length > 0 ||
                      relCount > 0 ||
                      linkedLocCount > 0) && (
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
                            {linkedLocCount} location
                            {linkedLocCount !== 1 && "s"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(character.id);
                    }}
                    className="absolute right-2 top-2 rounded-md bg-white/80 px-2 py-1 text-xs text-neutral-500 opacity-0 backdrop-blur transition-opacity hover:text-red-500 group-hover:opacity-100 dark:bg-neutral-900/80 dark:text-neutral-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && deletingId && deletingCharacter && (
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
