"use client";

import { ChevronDown, MapPin, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useProjectHref, useReadOnly } from "@/context/DataSourceContext";
import { createLocation, deleteLocation } from "@/db/operations";
import type { Location, LocationId, ProjectId } from "@/db/schemas";
import {
  useCharactersByProject,
  useLocationsByProject,
} from "@/hooks/data/source";

interface LocationNode {
  location: Location;
  children: LocationNode[];
  depth: number;
}

function buildLocationTree(locations: Location[]): LocationNode[] {
  const childrenMap = new Map<LocationId | null, Location[]>();
  for (const loc of locations) {
    const parentId = loc.parentLocationId ?? null;
    const arr = childrenMap.get(parentId) ?? [];
    arr.push(loc);
    childrenMap.set(parentId, arr);
  }

  function buildNodes(
    parentId: LocationId | null,
    depth: number,
  ): LocationNode[] {
    const children = childrenMap.get(parentId) ?? [];
    return children.map((loc) => ({
      location: loc,
      children: buildNodes(loc.id, depth + 1),
      depth,
    }));
  }

  return buildNodes(null, 0);
}

export interface LocationsPageBodyProps {
  projectId: ProjectId;
}

export function LocationsPageBody({ projectId }: LocationsPageBodyProps) {
  const router = useRouter();
  const basePath = useProjectHref(projectId);
  const readOnly = useReadOnly();
  const locations = useLocationsByProject(projectId);
  const characters = useCharactersByProject(projectId);
  const [expanded, setExpanded] = useState<Set<LocationId>>(() => new Set());
  const [deletingId, setDeletingId] = useState<LocationId | null>(null);
  const [initialized, setInitialized] = useState(false);

  const tree = useMemo(() => buildLocationTree(locations ?? []), [locations]);

  const characterMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of characters ?? []) m.set(c.id, c.name);
    return m;
  }, [characters]);

  if (!initialized && locations && locations.length > 0) {
    setExpanded(new Set(locations.map((l) => l.id)));
    setInitialized(true);
  }

  function toggleExpand(id: LocationId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(parentLocationId?: LocationId) {
    const location = await createLocation({
      projectId,
      name: "New Location",
      parentLocationId: parentLocationId ?? null,
    });
    if (parentLocationId) {
      setExpanded((prev) => new Set(prev).add(parentLocationId));
    }
    router.push(`${basePath}/bible/locations/${location.id}`);
  }

  function hasChildren(locationId: LocationId): boolean {
    return (locations ?? []).some((l) => l.parentLocationId === locationId);
  }

  const deletingLocation = locations?.find((l) => l.id === deletingId);
  const deletingHasChildren = deletingId ? hasChildren(deletingId) : false;

  function renderNode(node: LocationNode) {
    const isExpanded = expanded.has(node.location.id);
    const hasKids = node.children.length > 0;
    const linkedChars = node.location.linkedCharacterIds ?? [];

    return (
      <div key={node.location.id}>
        <div
          className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900"
          style={{ marginLeft: `${node.depth * 24}px` }}
        >
          {hasKids ? (
            <button
              type="button"
              onClick={() => toggleExpand(node.location.id)}
              className="mt-0.5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${isExpanded ? "" : "-rotate-90"}`}
              />
            </button>
          ) : (
            <MapPin
              size={16}
              className="mt-0.5 shrink-0 text-neutral-300 dark:text-neutral-600"
            />
          )}

          {(() => {
            const primaryImg = (node.location.images ?? []).find(
              (img) => img.isPrimary,
            );
            return primaryImg ? (
              // biome-ignore lint/performance/noImgElement: external URLs
              <img
                src={primaryImg.url}
                alt={node.location.name}
                className="h-10 w-10 shrink-0 rounded object-cover"
              />
            ) : null;
          })()}

          <button
            type="button"
            onClick={() =>
              router.push(`${basePath}/bible/locations/${node.location.id}`)
            }
            className="flex-1 text-left"
          >
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {node.location.name}
            </h3>
            {node.location.description && (
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 line-clamp-2 dark:text-neutral-400">
                {node.location.description}
              </p>
            )}
            {linkedChars.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {linkedChars.map((cid) => (
                  <span
                    key={cid}
                    className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    {characterMap.get(cid) ?? "Unknown"}
                  </span>
                ))}
              </div>
            )}
          </button>

          {!readOnly && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => handleCreate(node.location.id)}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                title="Add child location"
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(node.location.id)}
                className="text-xs text-neutral-400 hover:text-red-500 dark:text-neutral-500"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {isExpanded && hasKids && (
          <div className="mt-1.5 space-y-1.5">
            {node.children.map(renderNode)}
          </div>
        )}
      </div>
    );
  }

  const isEmpty = !locations || locations.length === 0;

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Locations
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={() => handleCreate()}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
          >
            Add Location
          </button>
        )}
      </div>
      <div className="mt-6 space-y-1.5">
        {isEmpty && (
          <div className="flex flex-col items-center gap-3 py-16 text-neutral-400 dark:text-neutral-500">
            <MapPin size={40} strokeWidth={1.5} />
            <p className="text-sm">
              {readOnly
                ? "No locations in this project."
                : "No locations yet. Add one to get started."}
            </p>
          </div>
        )}
        {tree.map(renderNode)}
      </div>

      {!readOnly && deletingId && deletingLocation && (
        <ConfirmDialog
          title="Delete Location"
          message={
            deletingHasChildren ? (
              <>
                <strong>{deletingLocation.name}</strong> has child locations.
                Deleting it will orphan those children. Are you sure?
              </>
            ) : (
              <>
                Are you sure you want to delete{" "}
                <strong>{deletingLocation.name}</strong>? This action cannot be
                undone.
              </>
            )
          }
          variant="danger"
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteLocation(deletingId);
            setDeletingId(null);
          }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
