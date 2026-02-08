"use client";

import {
  BookOpen,
  ChevronLeft,
  Eye,
  Heart,
  ImageIcon,
  Link as LinkIcon,
  MessageSquare,
  StickyNote,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { CollapsibleSection } from "@/components/bible/CollapsibleSection";
import { ImageGallery } from "@/components/bible/ImageGallery";
import { RoleBadge } from "@/components/bible/RoleBadge";
import {
  AutoResizeTextarea,
  useHeightSync,
} from "@/components/ui/AutoResizeTextarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteCharacter, updateCharacter } from "@/db/operations";
import type { CharacterRole } from "@/db/schemas";
import {
  useCharacter,
  useCharactersByProject,
  useLocationsByProject,
  useRelationshipsByProject,
} from "@/hooks/useBibleEntries";
import { useCharacterForm } from "@/hooks/useCharacterForm";

export default function CharacterDetailPage() {
  const params = useParams<{ projectId: string; characterId: string }>();
  const router = useRouter();
  const character = useCharacter(params.characterId);
  const characters = useCharactersByProject(params.projectId);
  const locations = useLocationsByProject(params.projectId);
  const relationships = useRelationshipsByProject(params.projectId);
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
  } = useCharacterForm(character);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const personalitySync = useHeightSync();
  const strengthsSync = useHeightSync();

  if (!character) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await updateCharacter(params.characterId, getUpdatePayload());
  }

  async function handleDelete() {
    await deleteCharacter(params.characterId);
    router.push(`/projects/${params.projectId}/bible/characters`);
  }

  // Characters available to link (not self, not already linked)
  const availableCharacters = (characters ?? []).filter(
    (c) =>
      c.id !== params.characterId && !form.linkedCharacterIds.includes(c.id),
  );

  // Locations available to link (not already linked)
  const availableLocations = (locations ?? []).filter(
    (l) => !form.linkedLocationIds.includes(l.id),
  );

  // Relationships for this character
  const charRelationships = (relationships ?? []).filter(
    (r) =>
      r.sourceCharacterId === params.characterId ||
      r.targetCharacterId === params.characterId,
  );

  const characterMap = new Map((characters ?? []).map((c) => [c.id, c]));
  const locationMap = new Map((locations ?? []).map((l) => [l.id, l]));

  const inputClass =
    "mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100";
  const labelClass =
    "block text-sm font-medium text-neutral-700 dark:text-neutral-300";

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <form onSubmit={handleSave} className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${params.projectId}/bible/characters`}
              className="rounded-md p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <ChevronLeft size={20} />
            </Link>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="text-2xl font-bold text-neutral-900 bg-transparent border-none outline-none dark:text-neutral-100"
              placeholder="Character Name"
            />
            <RoleBadge role={form.role} />
          </div>
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
              disabled={!isDirty}
              className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
            >
              Save
            </button>
          </div>
        </div>

        {/* Identity */}
        <CollapsibleSection title="Identity" icon={User}>
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
        </CollapsibleSection>

        {/* Appearance */}
        <CollapsibleSection title="Appearance" icon={Eye}>
          <AutoResizeTextarea
            label="Physical Description"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            minRows={3}
            className={inputClass}
            labelClassName={labelClass}
            placeholder="Appearance, distinguishing features, mannerisms..."
          />
        </CollapsibleSection>

        {/* Personality */}
        <CollapsibleSection title="Personality" icon={Heart}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <AutoResizeTextarea
                label="Personality"
                value={form.personality}
                onChange={(e) => setField("personality", e.target.value)}
                minRows={3}
                className={inputClass}
                labelClassName={labelClass}
                placeholder="Temperament, habits, social behavior..."
                heightSync={personalitySync}
              />
              <AutoResizeTextarea
                label="Motivations"
                value={form.motivations}
                onChange={(e) => setField("motivations", e.target.value)}
                minRows={3}
                className={inputClass}
                labelClassName={labelClass}
                placeholder="Goals, desires, what drives them..."
                heightSync={personalitySync}
              />
            </div>
            <AutoResizeTextarea
              label="Internal Conflict"
              value={form.internalConflict}
              onChange={(e) => setField("internalConflict", e.target.value)}
              minRows={3}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Inner struggles, contradictions, moral dilemmas..."
            />
            <div className="grid grid-cols-2 gap-4">
              <AutoResizeTextarea
                label="Strengths"
                value={form.strengths}
                onChange={(e) => setField("strengths", e.target.value)}
                minRows={3}
                className={inputClass}
                labelClassName={labelClass}
                placeholder="Skills, virtues, advantages..."
                heightSync={strengthsSync}
              />
              <AutoResizeTextarea
                label="Weaknesses"
                value={form.weaknesses}
                onChange={(e) => setField("weaknesses", e.target.value)}
                minRows={3}
                className={inputClass}
                labelClassName={labelClass}
                placeholder="Flaws, vulnerabilities, blind spots..."
                heightSync={strengthsSync}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Voice */}
        <CollapsibleSection title="Voice" icon={MessageSquare}>
          <AutoResizeTextarea
            label="Dialogue Style"
            value={form.dialogueStyle}
            onChange={(e) => setField("dialogueStyle", e.target.value)}
            minRows={3}
            className={inputClass}
            labelClassName={labelClass}
            placeholder="Speech patterns, vocabulary, verbal tics..."
          />
        </CollapsibleSection>

        {/* Story */}
        <CollapsibleSection title="Story" icon={BookOpen}>
          <div className="space-y-4">
            <AutoResizeTextarea
              label="Character Arcs"
              value={form.characterArcs}
              onChange={(e) => setField("characterArcs", e.target.value)}
              minRows={3}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Growth, transformation, key turning points..."
            />
            <AutoResizeTextarea
              label="Backstory"
              value={form.backstory}
              onChange={(e) => setField("backstory", e.target.value)}
              minRows={5}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Character history and background..."
            />
          </div>
        </CollapsibleSection>

        {/* Connections */}
        <CollapsibleSection title="Connections" icon={LinkIcon}>
          <div className="space-y-5">
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
                      <button
                        type="button"
                        onClick={() => removeLinkedCharacterId(cid)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
              {availableCharacters.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addLinkedCharacterId(e.target.value);
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
                      <button
                        type="button"
                        onClick={() => removeLinkedLocationId(lid)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
              {availableLocations.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addLinkedLocationId(e.target.value);
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
                      rel.sourceCharacterId === params.characterId
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
          </div>
        </CollapsibleSection>

        {/* Images */}
        <CollapsibleSection
          title="Images"
          icon={ImageIcon}
          defaultOpen={form.images.length > 0}
        >
          <ImageGallery
            images={form.images}
            onAddImage={addImage}
            onRemoveImage={removeImage}
            onSetPrimary={setPrimaryImage}
          />
        </CollapsibleSection>

        {/* Notes */}
        <CollapsibleSection
          title="Notes"
          icon={StickyNote}
          defaultOpen={!!form.notes}
        >
          <AutoResizeTextarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            minRows={4}
            className={inputClass}
            labelClassName={labelClass}
            placeholder="Freeform notes..."
          />
        </CollapsibleSection>
      </form>

      {showDeleteConfirm && (
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
