"use client";

import {
  ChevronLeft,
  ChevronRight,
  Film,
  ImageIcon,
  Link as LinkIcon,
  type LucideIcon,
  MapPin,
  Network,
  StickyNote,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { ImageGallery } from "@/components/bible/ImageGallery";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MarkdownField } from "@/components/ui/MarkdownField";
import { deleteLocation, updateLocation } from "@/db/operations";
import type {
  CharacterId,
  Location,
  LocationId,
  ProjectId,
} from "@/db/schemas";
import {
  useCharactersByProject,
  useLocation,
  useLocationsByProject,
} from "@/hooks/data/source";
import { useChaptersByProject } from "@/hooks/data/useChapter";
import { useScenesByProject } from "@/hooks/data/useScene";
import { useLocationForm } from "@/hooks/forms/useLocationForm";
import { getTerm } from "@/lib/terminology";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

export interface LocationDetailBodyProps {
  projectId: ProjectId;
  locationId: LocationId;
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

interface LocationTreeNode {
  location: Location;
  children: LocationTreeNode[];
  depth: number;
}

/** Build the subtree rooted at each direct child of `rootId`. */
function buildSubtree(
  locations: Location[],
  rootId: LocationId,
): LocationTreeNode[] {
  const childrenMap = new Map<LocationId | null, Location[]>();
  for (const loc of locations) {
    const parentId = loc.parentLocationId ?? null;
    const arr = childrenMap.get(parentId) ?? [];
    arr.push(loc);
    childrenMap.set(parentId, arr);
  }
  const visited = new Set<LocationId>();
  function build(parentId: LocationId, depth: number): LocationTreeNode[] {
    return (childrenMap.get(parentId) ?? [])
      .filter((loc) => !visited.has(loc.id))
      .map((loc) => {
        visited.add(loc.id);
        return {
          location: loc,
          children: build(loc.id, depth + 1),
          depth,
        };
      });
  }
  return build(rootId, 0);
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
    addImage,
    removeImage,
    setPrimaryImage,
    updateImage,
  } = useLocationForm(location);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const locationById = useMemo(() => {
    const m = new Map<string, Location>();
    for (const l of locations ?? []) m.set(l.id, l);
    return m;
  }, [locations]);

  // Ancestor chain root → immediate parent (excludes the current location).
  const ancestors = useMemo(() => {
    const chain: Location[] = [];
    const visited = new Set<string>([locationId]);
    let current = location?.parentLocationId ?? null;
    while (current && !visited.has(current)) {
      visited.add(current);
      const parent = locationById.get(current);
      if (!parent) break;
      chain.unshift(parent);
      current = parent.parentLocationId ?? null;
    }
    return chain;
  }, [location, locationId, locationById]);

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

  const subtree = useMemo(
    () => buildSubtree(locations ?? [], locationId),
    [locations, locationId],
  );

  // Scenes set at this location, ordered by chapter then scene position.
  const sceneTerm = getTerm(projectMode, "scene");
  const chapterOrder = useMemo(
    () => new Map((chapters ?? []).map((c, i) => [c.id, i])),
    [chapters],
  );
  const chapterById = useMemo(
    () => new Map((chapters ?? []).map((c) => [c.id, c])),
    [chapters],
  );
  const sceneCountByChapter = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of scenes ?? []) {
      m.set(s.chapterId, (m.get(s.chapterId) ?? 0) + 1);
    }
    return m;
  }, [scenes]);
  const scenesHere = useMemo(
    () =>
      (scenes ?? [])
        .filter((s) => s.locationIds.includes(locationId))
        .sort((a, b) => {
          const byChapter =
            (chapterOrder.get(a.chapterId) ?? 0) -
            (chapterOrder.get(b.chapterId) ?? 0);
          return byChapter !== 0 ? byChapter : a.order - b.order;
        }),
    [scenes, locationId, chapterOrder],
  );

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

  const primaryImage = form.images.find((img) => img.isPrimary);

  const inputClass =
    "mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100";
  const labelClass =
    "block text-sm font-medium text-neutral-700 dark:text-neutral-300";

  function renderTreeNode(node: LocationTreeNode) {
    return (
      <div key={node.location.id}>
        <Link
          href={`${basePath}/bible/locations/${node.location.id}`}
          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          style={{ marginLeft: `${node.depth * 20}px` }}
        >
          <MapPin
            size={14}
            className="mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500"
          />
          <span className="min-w-0 flex-1">
            <span className="font-medium">{node.location.name}</span>
            {node.location.description && (
              <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                {node.location.description}
              </span>
            )}
          </span>
        </Link>
        {node.children.map(renderTreeNode)}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl gap-8 px-8 py-8">
      <div className="min-w-0 flex-1">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`${basePath}/bible/locations`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <ChevronLeft size={16} />
            Locations
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
                form="location-form"
                disabled={!isDirty}
                className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
              >
                Save
              </button>
            </div>
          )}
        </div>

        <form id="location-form" onSubmit={handleSave} className="space-y-8">
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
                    <MapPin size={40} strokeWidth={1.5} />
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              {/* Ancestor breadcrumb */}
              {ancestors.length > 0 && (
                <nav className="flex flex-wrap items-center gap-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                  {ancestors.map((ancestor) => (
                    <span
                      key={ancestor.id}
                      className="flex items-center gap-0.5"
                    >
                      <Link
                        href={`${basePath}/bible/locations/${ancestor.id}`}
                        className="rounded px-1 py-0.5 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                      >
                        {ancestor.name}
                      </Link>
                      <ChevronRight size={12} className="shrink-0" />
                    </span>
                  ))}
                </nav>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  readOnly={readOnly}
                  className="border-none bg-transparent text-2xl font-bold text-neutral-900 outline-none dark:text-neutral-100"
                  placeholder="Location Name"
                />
              </div>

              {/* Scene count */}
              {scenesHere.length > 0 ? (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                    {scenesHere.length}
                  </span>{" "}
                  {getTerm(projectMode, "scenes").toLowerCase()} set here
                </p>
              ) : (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  Not set in any {sceneTerm.toLowerCase()} yet
                </p>
              )}

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

              <MarkdownField
                label="Description"
                value={form.description}
                onChange={(v) => setField("description", v)}
                readOnly={readOnly}
                minRows={4}
                className={inputClass}
                labelClassName={labelClass}
                placeholder="Describe this location..."
              />
            </div>
          </div>

          {/* Sub-locations */}
          <section className="space-y-4">
            <SectionHeading icon={Network} title="Sub-locations" />
            {subtree.length > 0 ? (
              <div className="space-y-0.5">{subtree.map(renderTreeNode)}</div>
            ) : (
              <p className="text-sm text-neutral-400 dark:text-neutral-500">
                No sub-locations.
              </p>
            )}
          </section>

          {/* Connections */}
          <section className="space-y-4">
            <SectionHeading icon={LinkIcon} title="Connections" />
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

      {/* Scenes-here sidebar */}
      {scenesHere.length > 0 && (
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
              {scenesHere.map((scene) => {
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
                return (
                  <Link
                    key={scene.id}
                    href={`${basePath}/chapters/${scene.chapterId}?scene=${scene.id}`}
                    onClick={() => requestSceneScroll(scene.id)}
                    className="block rounded-md px-2 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <span className="line-clamp-2">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      )}

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
