"use client";

import { useParams, useRouter } from "next/navigation";
import {
  createWorldbuildingDoc,
  deleteWorldbuildingDoc,
} from "@/db/operations";
import { useWorldbuildingDocsByProject } from "@/hooks/useBibleEntries";

export default function WorldbuildingListPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const docs = useWorldbuildingDocsByProject(params.projectId);

  async function handleCreate() {
    const doc = await createWorldbuildingDoc({
      projectId: params.projectId,
      title: "New Document",
    });
    router.push(`/projects/${params.projectId}/bible/worldbuilding/${doc.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Worldbuilding
        </h2>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add Document
        </button>
      </div>
      <div className="mt-6 space-y-3">
        {docs?.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No worldbuilding documents yet.
          </p>
        )}
        {docs?.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/projects/${params.projectId}/bible/worldbuilding/${doc.id}`,
                )
              }
              className="text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {doc.title}
              </h3>
              {doc.tags.length > 0 && (
                <div className="mt-1 flex gap-1">
                  {doc.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => deleteWorldbuildingDoc(doc.id)}
              className="text-xs text-zinc-400 hover:text-red-500 dark:text-zinc-500"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
