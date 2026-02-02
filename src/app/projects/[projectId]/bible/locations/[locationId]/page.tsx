"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { deleteLocation, updateLocation } from "@/db/operations";
import { useLocation } from "@/hooks/useBibleEntries";

export default function LocationDetailPage() {
  const params = useParams<{ projectId: string; locationId: string }>();
  const router = useRouter();
  const location = useLocation(params.locationId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (location) {
      setName(location.name);
      setDescription(location.description);
      setNotes(location.notes);
    }
  }, [location]);

  const isDirty = useMemo(() => {
    if (!location) return false;
    return (
      name !== location.name ||
      description !== location.description ||
      notes !== location.notes
    );
  }, [location, name, description, notes]);

  if (!location) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await updateLocation(params.locationId, { name, description, notes });
  }

  async function handleDelete() {
    await deleteLocation(params.locationId);
    router.push(`/projects/${params.projectId}/bible/locations`);
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${params.projectId}/bible/locations`}
              className="rounded-md p-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>Back to locations</title>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-2xl font-bold text-zinc-900 bg-transparent border-none outline-none dark:text-zinc-100"
              placeholder="Location Name"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
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
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Describe this location..."
            />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Freeform notes..."
            />
          </label>
        </div>
      </form>
    </div>
  );
}
