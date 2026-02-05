"use client";

import {
  ChevronLeft,
  Link as LinkIcon,
  MapPin,
  StickyNote,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { CollapsibleSection } from "@/components/bible/CollapsibleSection";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteLocation, updateLocation } from "@/db/operations";
import {
  useCharactersByProject,
  useLocation,
  useLocationsByProject,
} from "@/hooks/useBibleEntries";
import { useLocationForm } from "@/hooks/useLocationForm";

export default function LocationDetailPage() {
  const params = useParams<{ projectId: string; locationId: string }>();
  const router = useRouter();
  const location = useLocation(params.locationId);
  const locations = useLocationsByProject(params.projectId);
  const characters = useCharactersByProject(params.projectId);
  const {
    form,
    setField,
    isDirty,
    getUpdatePayload,
    addLinkedCharacterId,
    removeLinkedCharacterId,
  } = useLocationForm(location);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Build set of descendants so we can exclude them from parent selector
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
    collect(params.locationId);
    return ids;
  }, [locations, params.locationId]);

  if (!location) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await updateLocation(params.locationId, getUpdatePayload());
  }

  async function handleDelete() {
    await deleteLocation(params.locationId);
    router.push(`/projects/${params.projectId}/bible/locations`);
  }

  // Parent location options: exclude self and descendants
  const parentOptions = (locations ?? []).filter(
    (l) => l.id !== params.locationId && !descendantIds.has(l.id),
  );

  // Characters available to link
  const availableCharacters = (characters ?? []).filter(
    (c) => !form.linkedCharacterIds.includes(c.id),
  );

  const characterMap = new Map((characters ?? []).map((c) => [c.id, c]));

  const inputClass =
    "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
  const labelClass =
    "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <form onSubmit={handleSave} className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${params.projectId}/bible/locations`}
              className="rounded-md p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronLeft size={20} />
            </Link>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="text-2xl font-bold text-zinc-900 bg-transparent border-none outline-none dark:text-zinc-100"
              placeholder="Location Name"
            />
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
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save
            </button>
          </div>
        </div>

        {/* Details */}
        <CollapsibleSection title="Details" icon={MapPin}>
          <div className="space-y-4">
            <label className={labelClass}>
              Parent Location
              <select
                value={form.parentLocationId ?? ""}
                onChange={(e) =>
                  setField("parentLocationId", e.target.value || null)
                }
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
              className={inputClass}
              labelClassName={labelClass}
              placeholder="Describe this location..."
            />
          </div>
        </CollapsibleSection>

        {/* Connections */}
        <CollapsibleSection title="Connections" icon={LinkIcon}>
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
