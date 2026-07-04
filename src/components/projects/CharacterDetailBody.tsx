"use client";

import {
  BookOpen,
  ChevronLeft,
  Eye,
  Film,
  Heart,
  ImageIcon,
  Link as LinkIcon,
  type LucideIcon,
  MessageSquare,
  StickyNote,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ImageGallery } from "@/components/bible/ImageGallery";
import { RoleBadge } from "@/components/bible/RoleBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MarkdownField } from "@/components/ui/MarkdownField";
import { deleteCharacter, updateCharacter } from "@/db/operations";
import type {
  CharacterId,
  CharacterRole,
  LocationId,
  ProjectId,
} from "@/db/schemas";
import {
  useCharacter,
  useCharactersByProject,
  useLocationsByProject,
  useRelationshipsByProject,
} from "@/hooks/data/source";
import { useChaptersByProject } from "@/hooks/data/useChapter";
import { useScenesByProject } from "@/hooks/data/useScene";
import { useCharacterForm } from "@/hooks/forms/useCharacterForm";
import { getInitials } from "@/lib/characters/initials";
import { getTerm } from "@/lib/terminology";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

export interface CharacterDetailBodyProps {
  projectId: ProjectId;
  characterId: CharacterId;
  /** URL prefix without trailing slash; e.g. `/projects/abc` or
   *  `/shared/room/projects/abc`. Used for back navigation. */
  basePath: string;
  readOnly: boolean;
}

/** Plain (non-collapsing) section heading: icon + title. */
function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-neutral-200 pb-2 dark:border-neutral-800">
      <Icon size={16} className="text-neutral-400 dark:text-neutral-500" />
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h3>
    </div>
  );
}

export function CharacterDetailBody({
  projectId,
  characterId,
  basePath,
  readOnly,
}: CharacterDetailBodyProps) {
  const router = useRouter();
  const character = useCharacter(characterId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const relationships = useRelationshipsByProject(projectId);
  const scenes = useScenesByProject(projectId);
  const chapters = useChaptersByProject(projectId);
  const requestSceneScroll = useEditorStore((s) => s.requestSceneScroll);
  const projectMode = useProjectStore((s) => s.activeProjectMode);
  const {
    form,
    setField,
    isDirty,
    getUpdatePayload,
    addLinkedCharacterId,
    removeLinkedCharacterId,
    addLinkedLocationId,
    removeLinkedLocationId,
    addImage,
    removeImage,
    setPrimaryImage,
    updateImage,
  } = useCharacterForm(character);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!character) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    await updateCharacter(
      characterId,
      getUpdatePayload() as Parameters<typeof updateCharacter>[1],
    );
  }

  async function handleDelete() {
    if (readOnly) return;
    await deleteCharacter(characterId);
    router.push(`${basePath}/bible/characters`);
  }

  // Characters available to link (not self, not already linked)
  const availableCharacters = (characters ?? []).filter(
    (c) => c.id !== characterId && !form.linkedCharacterIds.includes(c.id),
  );

  // Locations available to link (not already linked)
  const availableLocations = (locations ?? []).filter(
    (l) => !form.linkedLocationIds.includes(l.id),
  );

  // Relationships for this character
  const charRelationships = (relationships ?? []).filter(
    (r) =>
      r.sourceCharacterId === characterId ||
      r.targetCharacterId === characterId,
  );

  const characterMap = new Map((characters ?? []).map((c) => [c.id, c]));
  const locationMap = new Map((locations ?? []).map((l) => [l.id, l]));

  const primaryImage = form.images.find((img) => img.isPrimary);
  const initials = getInitials(form.name);

  // Scene participation (Model D). A scene "features" this character when they
  // are its POV or appear in its present cast; POV and supporting counts are
  // disjoint so they sum to the total.
  const sceneTerm = getTerm(projectMode, "scene");
  const allScenes = scenes ?? [];
  const allChapters = chapters ?? [];
  const chapterById = new Map(allChapters.map((c) => [c.id, c]));
  const chapterOrder = new Map(allChapters.map((c, i) => [c.id, i]));
  const sceneCountByChapter = new Map<string, number>();
  for (const s of allScenes) {
    sceneCountByChapter.set(
      s.chapterId,
      (sceneCountByChapter.get(s.chapterId) ?? 0) + 1,
    );
  }
  const featuringScenes = allScenes
    .filter(
      (s) =>
        s.povCharacterId === characterId ||
        s.presentCharacterIds.includes(characterId),
    )
    .sort((a, b) => {
      const byChapter =
        (chapterOrder.get(a.chapterId) ?? 0) -
        (chapterOrder.get(b.chapterId) ?? 0);
      return byChapter !== 0 ? byChapter : a.order - b.order;
    });
  const povCount = featuringScenes.filter(
    (s) => s.povCharacterId === characterId,
  ).length;
  const totalScenes = featuringScenes.length;
  const supportingCount = totalScenes - povCount;
  const projectPovTotal = allScenes.filter(
    (s) => s.povCharacterId !== null,
  ).length;
  const povPct =
    projectPovTotal > 0 ? Math.round((povCount / projectPovTotal) * 100) : 0;

  const inputClass =
    "mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100";
  const labelClass =
    "block text-sm font-medium text-neutral-700 dark:text-neutral-300";

  return (
    <div className="mx-auto flex max-w-5xl gap-8 px-8 py-8">
      <div className="min-w-0 flex-1">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`${basePath}/bible/characters`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <ChevronLeft size={16} />
            Characters
          </Link>
          {!readOnly && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </button>
              <button
                type="submit"
                form="character-form"
                disabled={!isDirty}
                className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
              >
                Save
              </button>
            </div>
          )}
        </div>

        <form id="character-form" onSubmit={handleSave} className="space-y-8">
          {/* Masthead: portrait thumbnail + identity */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="w-40 shrink-0 self-center overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 sm:self-start">
              <div className="aspect-[3/4] w-full">
                {primaryImage ? (
                  // biome-ignore lint/performance/noImgElement: external URLs
                  <img
                    src={primaryImage.url}
                    alt={form.name}
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: `${(primaryImage.focalX ?? 0.5) * 100}% ${(primaryImage.focalY ?? 0) * 100}%`,
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                    {initials ? (
                      <span className="text-4xl font-semibold">{initials}</span>
                    ) : (
                      <Users size={40} strokeWidth={1.5} />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  readOnly={readOnly}
                  className="border-none bg-transparent text-2xl font-bold text-neutral-900 outline-none dark:text-neutral-100"
                  placeholder="Character Name"
                />
                <RoleBadge role={form.role} />
              </div>

              {/* Scene stats */}
              {totalScenes > 0 ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <span>
                    <span className="font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                      {supportingCount}
                    </span>{" "}
                    supporting
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                      {povCount}
                    </span>{" "}
                    POV
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                      {totalScenes}
                    </span>{" "}
                    total
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    <span className="font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                      {povPct}%
                    </span>{" "}
                    of POV {getTerm(projectMode, "scenes").toLowerCase()}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  Not in any {sceneTerm.toLowerCase()} yet
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className={labelClass}>
                  Role
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setField("role", e.target.value as CharacterRole)
                    }
                    disabled={readOnly}
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
                    readOnly={readOnly}
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
                    readOnly={readOnly}
                    className={inputClass}
                    placeholder="comma-separated"
                  />
                </label>
              </div>

              <MarkdownField
                label="Summary"
                value={form.summary}
                onChange={(v) => setField("summary", v)}
                readOnly={readOnly}
                minRows={3}
                className={inputClass}
                labelClassName={labelClass}
                placeholder="A quick overview of who this character is..."
              />
            </div>
          </div>

          {/* Appearance */}
          <section className="space-y-4">
            <SectionHeading icon={Eye} title="Appearance" />
            <MarkdownField
              label="Physical Description"
              value={form.description}
              onChange={(v) => setField("description", v)}
              readOnly={readOnly}
              minRows={3}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Appearance, distinguishing features, mannerisms..."
            />
          </section>

          {/* Personality */}
          <section className="space-y-4">
            <SectionHeading icon={Heart} title="Personality" />
            <MarkdownField
              label="Personality"
              value={form.personality}
              onChange={(v) => setField("personality", v)}
              readOnly={readOnly}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Temperament, habits, social behavior..."
            />
            <MarkdownField
              label="Motivations"
              value={form.motivations}
              onChange={(v) => setField("motivations", v)}
              readOnly={readOnly}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Goals, desires, what drives them..."
            />
            <MarkdownField
              label="Internal Conflict"
              value={form.internalConflict}
              onChange={(v) => setField("internalConflict", v)}
              readOnly={readOnly}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Inner struggles, contradictions, moral dilemmas..."
            />
            <MarkdownField
              label="Strengths"
              value={form.strengths}
              onChange={(v) => setField("strengths", v)}
              readOnly={readOnly}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Skills, virtues, advantages..."
            />
            <MarkdownField
              label="Weaknesses"
              value={form.weaknesses}
              onChange={(v) => setField("weaknesses", v)}
              readOnly={readOnly}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Flaws, vulnerabilities, blind spots..."
            />
          </section>

          {/* Voice */}
          <section className="space-y-4">
            <SectionHeading icon={MessageSquare} title="Voice" />
            <MarkdownField
              label="Dialogue Style"
              value={form.dialogueStyle}
              onChange={(v) => setField("dialogueStyle", v)}
              readOnly={readOnly}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Speech patterns, vocabulary, verbal tics..."
            />
          </section>

          {/* Story */}
          <section className="space-y-4">
            <SectionHeading icon={BookOpen} title="Story" />
            <MarkdownField
              label="Character Arcs"
              value={form.characterArcs}
              onChange={(v) => setField("characterArcs", v)}
              readOnly={readOnly}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Growth, transformation, key turning points..."
            />
            <MarkdownField
              label="Backstory"
              value={form.backstory}
              onChange={(v) => setField("backstory", v)}
              readOnly={readOnly}
              minRows={5}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Character history and background..."
            />
          </section>

          {/* Connections */}
          <section className="space-y-5">
            <SectionHeading icon={LinkIcon} title="Connections" />
            {/* Linked Characters */}
            <div>
              <p className={labelClass}>Linked Characters</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.linkedCharacterIds.map((cid) => {
                  const c = characterMap.get(cid);
                  return (
                    <span
                      key={cid}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {c?.name ?? "Unknown"}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeLinkedCharacterId(cid)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
              {!readOnly && availableCharacters.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      addLinkedCharacterId(e.target.value as CharacterId);
                  }}
                  className={`${inputClass} mt-2`}
                >
                  <option value="">Add a character...</option>
                  {availableCharacters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Linked Locations */}
            <div>
              <p className={labelClass}>Linked Locations</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.linkedLocationIds.map((lid) => {
                  const l = locationMap.get(lid);
                  return (
                    <span
                      key={lid}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    >
                      {l?.name ?? "Unknown"}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeLinkedLocationId(lid)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
              {!readOnly && availableLocations.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      addLinkedLocationId(e.target.value as LocationId);
                  }}
                  className={`${inputClass} mt-2`}
                >
                  <option value="">Add a location...</option>
                  {availableLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Relationships (read-only) */}
            {charRelationships.length > 0 && (
              <div>
                <p className={labelClass}>Relationships</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {charRelationships.map((rel) => {
                    const otherId =
                      rel.sourceCharacterId === characterId
                        ? rel.targetCharacterId
                        : rel.sourceCharacterId;
                    const other = characterMap.get(otherId);
                    const label =
                      rel.type === "custom"
                        ? rel.customLabel || "custom"
                        : rel.type;
                    return (
                      <span
                        key={rel.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                      >
                        <span className="capitalize">{label}</span>
                        <span className="text-violet-400 dark:text-violet-500">
                          &rarr;
                        </span>
                        {other?.name ?? "Unknown"}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Images */}
          <section className="space-y-4">
            <SectionHeading icon={ImageIcon} title="Images" />
            <ImageGallery
              images={form.images}
              onAddImage={addImage}
              onRemoveImage={removeImage}
              onSetPrimary={setPrimaryImage}
              onUpdateImage={updateImage}
              readOnly={readOnly}
            />
          </section>

          {/* Notes */}
          <section className="space-y-4">
            <SectionHeading icon={StickyNote} title="Notes" />
            <MarkdownField
              label="Notes"
              value={form.notes}
              onChange={(v) => setField("notes", v)}
              readOnly={readOnly}
              minRows={4}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Freeform notes..."
            />
          </section>
        </form>
      </div>

      {/* Scene sidebar */}
      {featuringScenes.length > 0 && (
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-8">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <Film
                size={16}
                className="text-neutral-400 dark:text-neutral-500"
              />
              {getTerm(projectMode, "scenes")}
            </h3>
            <div className="space-y-0.5">
              {featuringScenes.map((scene) => {
                const chapter = chapterById.get(scene.chapterId);
                const chapterLabel =
                  chapter?.title ?? getTerm(projectMode, "chapter");
                const sceneName =
                  scene.title.trim() || `${sceneTerm} ${scene.order + 1}`;
                const showScenePart =
                  scene.title.trim() !== "" ||
                  (sceneCountByChapter.get(scene.chapterId) ?? 1) > 1;
                const label = showScenePart
                  ? `${chapterLabel} — ${sceneName}`
                  : chapterLabel;
                const isPov = scene.povCharacterId === characterId;
                return (
                  <Link
                    key={scene.id}
                    href={`${basePath}/chapters/${scene.chapterId}?scene=${scene.id}`}
                    onClick={() => requestSceneScroll(scene.id)}
                    className="flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <span
                      className="mt-px w-3.5 shrink-0"
                      title={isPov ? "POV scene" : undefined}
                    >
                      {isPov && (
                        <Eye
                          size={13}
                          className="text-primary-500 dark:text-primary-400"
                        />
                      )}
                    </span>
                    <span className="line-clamp-2 flex-1">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      )}

      {!readOnly && showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Character"
          message={
            <>
              Are you sure you want to delete <strong>{character.name}</strong>?
              This will also remove all relationships. This action cannot be
              undone.
            </>
          }
          variant="danger"
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
