"use client";

import {
  ChevronLeft,
  ImageIcon,
  Link as LinkIcon,
  MapPin,
  StickyNote,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { CollapsibleSection } from "@/components/bible/CollapsibleSection";
import { ImageGallery } from "@/components/bible/ImageGallery";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteLocation, updateLocation } from "@/db/operations";
import type { CharacterId, LocationId, ProjectId } from "@/db/schemas";
import {
  useCharactersByProject,
  useLocation,
  useLocationsByProject,
} from "@/hooks/data/source";
import { useLocationForm } from "@/hooks/forms/useLocationForm";

export interface LocationDetailBodyProps {
  projectId: ProjectId;
  locationId: LocationId;
  basePath: string;
  readOnly: boolean;
}

export function LocationDetailBody({
  projectId,
  locationId,
  basePath,
  readOnly,
}: LocationDetailBodyProps) {
  const router = useRouter();
  const location = useLocation(locationId);
  const locations = useLocationsByProject(projectId);
  const characters = useCharactersByProject(projectId);
  const {
    form,
    setField,
    isDirty,
    getUpdatePayload,
    addLinkedCharacterId,
    removeLinkedCharacterId,
    addImage,
    removeImage,
    setPrimaryImage,
  } = useLocationForm(location);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const descendantIds = useMemo(() => {
    const ids = new Set<string>();
    if (!locations) return ids;
    function collect(parentId: string) {
      for (const loc of locations as NonNullable<typeof locations>) {
        if (loc.parentLocationId === parentId && !ids.has(loc.id)) {
          ids.add(loc.id);
          collect(loc.id);
        }
      }
    }
    collect(locationId);
    return ids;
  }, [locations, locationId]);

  if (!location) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    await updateLocation(
      locationId,
      getUpdatePayload() as Parameters<typeof updateLocation>[1],
    );
  }

  async function handleDelete() {
    if (readOnly) return;
    await deleteLocation(locationId);
    router.push(`${basePath}/bible/locations`);
  }

  const parentOptions = (locations ?? []).filter(
    (l) => l.id !== locationId && !descendantIds.has(l.id),
  );

  const availableCharacters = (characters ?? []).filter(
    (c) => !form.linkedCharacterIds.includes(c.id),
  );

  const characterMap = new Map((characters ?? []).map((c) => [c.id, c]));

  const inputClass =
    "mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100";
  const labelClass =
    "block text-sm font-medium text-neutral-700 dark:text-neutral-300";

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`${basePath}/bible/locations`}
              className="rounded-md p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <ChevronLeft size={20} />
            </Link>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              readOnly={readOnly}
              className="text-2xl font-bold text-neutral-900 bg-transparent border-none outline-none dark:text-neutral-100"
              placeholder="Location Name"
            />
          </div>
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
                disabled={!isDirty}
                className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
              >
                Save
              </button>
            </div>
          )}
        </div>

        <CollapsibleSection title="Details" icon={MapPin}>
          <div className="space-y-4">
            <label className={labelClass}>
              Parent Location
              <select
                value={form.parentLocationId ?? ""}
                onChange={(e) =>
                  setField("parentLocationId", e.target.value || null)
                }
                disabled={readOnly}
                className={inputClass}
              >
                <option value="">None (top-level)</option>
                {parentOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <AutoResizeTextarea
              label="Description"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              minRows={6}
              disabled={readOnly}
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Describe this location..."
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Connections" icon={LinkIcon}>
          <div>
            <p className={labelClass}>Linked Characters</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {form.linkedCharacterIds.map((cid) => {
                const c = characterMap.get(cid as CharacterId);
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
        </CollapsibleSection>

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
            readOnly={readOnly}
          />
        </CollapsibleSection>

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
            disabled={readOnly}
            className={inputClass}
            labelClassName={labelClass}
            placeholder="Freeform notes..."
          />
        </CollapsibleSection>
      </form>

      {!readOnly && showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Location"
          message={
            <>
              Are you sure you want to delete <strong>{location.name}</strong>?
              This action cannot be undone.
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
