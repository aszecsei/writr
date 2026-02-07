"use client";

import { diffWords } from "diff";
import { ArrowLeft, GitCompare, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import {
  createSnapshot,
  deleteSnapshot,
  updateChapterContent,
} from "@/db/operations";
import type { ChapterSnapshot } from "@/db/schemas";
import { useChapter } from "@/hooks/useChapter";
import { useSnapshotsByChapter } from "@/hooks/useSnapshots";
import { useEditorStore } from "@/store/editorStore";
import { isVersionHistoryModal, useUiStore } from "@/store/uiStore";

type View = "list" | "diff";

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

function InlineDiff({
  oldText,
  newText,
}: {
  oldText: string;
  newText: string;
}) {
  const changes = diffWords(oldText, newText);

  // Build stable keys from running character offset
  let offset = 0;
  const parts = changes.map((part) => {
    const key = `${offset}-${part.added ? "a" : part.removed ? "r" : "e"}`;
    offset += part.value.length;
    return { ...part, key };
  });

  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
      {parts.map((part) => {
        if (part.added) {
          return (
            <span
              key={part.key}
              className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={part.key}
              className="bg-red-100 text-red-800 line-through dark:bg-red-900/40 dark:text-red-300"
            >
              {part.value}
            </span>
          );
        }
        return <span key={part.key}>{part.value}</span>;
      })}
    </div>
  );
}

export function VersionHistoryDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const markSaved = useEditorStore((s) => s.markSaved);
  const bumpContentVersion = useEditorStore((s) => s.bumpContentVersion);

  const [view, setView] = useState<View>("list");
  const [snapshotName, setSnapshotName] = useState("");
  const [diffSnapshot, setDiffSnapshot] = useState<ChapterSnapshot | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  if (!isVersionHistoryModal(modal)) return null;

  const { chapterId, projectId } = modal;

  return (
    <VersionHistoryContent
      chapterId={chapterId}
      projectId={projectId}
      closeModal={closeModal}
      markSaved={markSaved}
      bumpContentVersion={bumpContentVersion}
      view={view}
      setView={setView}
      snapshotName={snapshotName}
      setSnapshotName={setSnapshotName}
      diffSnapshot={diffSnapshot}
      setDiffSnapshot={setDiffSnapshot}
      confirmDelete={confirmDelete}
      setConfirmDelete={setConfirmDelete}
      confirmRestore={confirmRestore}
      setConfirmRestore={setConfirmRestore}
    />
  );
}

function VersionHistoryContent({
  chapterId,
  projectId,
  closeModal,
  markSaved,
  bumpContentVersion,
  view,
  setView,
  snapshotName,
  setSnapshotName,
  diffSnapshot,
  setDiffSnapshot,
  confirmDelete,
  setConfirmDelete,
  confirmRestore,
  setConfirmRestore,
}: {
  chapterId: string;
  projectId: string;
  closeModal: () => void;
  markSaved: () => void;
  bumpContentVersion: () => void;
  view: View;
  setView: (v: View) => void;
  snapshotName: string;
  setSnapshotName: (v: string) => void;
  diffSnapshot: ChapterSnapshot | null;
  setDiffSnapshot: (v: ChapterSnapshot | null) => void;
  confirmDelete: string | null;
  setConfirmDelete: (v: string | null) => void;
  confirmRestore: string | null;
  setConfirmRestore: (v: string | null) => void;
}) {
  const snapshots = useSnapshotsByChapter(chapterId);
  const chapter = useChapter(chapterId);

  const handleCreate = useCallback(async () => {
    if (!snapshotName.trim() || !chapter) return;
    await createSnapshot({
      chapterId,
      projectId,
      name: snapshotName.trim(),
      content: chapter.content,
      wordCount: chapter.wordCount,
    });
    setSnapshotName("");
  }, [snapshotName, chapter, chapterId, projectId, setSnapshotName]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSnapshot(id);
      setConfirmDelete(null);
    },
    [setConfirmDelete],
  );

  const handleRestore = useCallback(
    async (snapshot: ChapterSnapshot) => {
      await updateChapterContent(
        chapterId,
        snapshot.content,
        snapshot.wordCount,
      );
      markSaved();
      bumpContentVersion();
      setConfirmRestore(null);
      closeModal();
    },
    [chapterId, markSaved, bumpContentVersion, setConfirmRestore, closeModal],
  );

  const handleCompare = useCallback(
    (snapshot: ChapterSnapshot) => {
      setDiffSnapshot(snapshot);
      setView("diff");
    },
    [setDiffSnapshot, setView],
  );

  const handleBackToList = useCallback(() => {
    setView("list");
    setDiffSnapshot(null);
  }, [setView, setDiffSnapshot]);

  return (
    <Modal onClose={closeModal} maxWidth="max-w-2xl">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Version History
      </h2>

      {view === "list" && (
        <>
          {/* Create snapshot */}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="Snapshot name..."
              className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!snapshotName.trim()}
              className={BUTTON_PRIMARY}
            >
              Save Snapshot
            </button>
          </div>

          {/* Snapshot list */}
          <div className="mt-4 max-h-[400px] overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700">
            {!snapshots || snapshots.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
                No snapshots yet. Save one to create a checkpoint.
              </p>
            ) : (
              <ul>
                {snapshots.map((snap) => (
                  <li
                    key={snap.id}
                    className="border-b border-neutral-100 px-4 py-3 last:border-b-0 dark:border-neutral-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {snap.name}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {formatRelativeTime(snap.createdAt)} &middot;{" "}
                          {snap.wordCount.toLocaleString()} words
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="Compare with current"
                          onClick={() => handleCompare(snap)}
                          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                        >
                          <GitCompare size={14} />
                        </button>
                        {confirmRestore === snap.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleRestore(snap)}
                              className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRestore(null)}
                              className="rounded-md px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Restore this snapshot"
                            onClick={() => setConfirmRestore(snap.id)}
                            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        {confirmDelete === snap.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(snap.id)}
                              className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-md px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Delete this snapshot"
                            onClick={() => setConfirmDelete(snap.id)}
                            className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-950 dark:hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {snapshots?.length ?? 0} snapshot
            {(snapshots?.length ?? 0) !== 1 && "s"}
          </p>
        </>
      )}

      {view === "diff" && diffSnapshot && (
        <>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleBackToList}
              className={BUTTON_CANCEL}
            >
              <ArrowLeft size={14} className="mr-1 inline" />
              Back
            </button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Comparing &ldquo;{diffSnapshot.name}&rdquo; with current
            </span>
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-red-100 dark:bg-red-900/40" />
              <span className="text-neutral-600 dark:text-neutral-400">
                Removed from snapshot
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-green-100 dark:bg-green-900/40" />
              <span className="text-neutral-600 dark:text-neutral-400">
                Added in current
              </span>
            </span>
          </div>

          {/* Diff content */}
          <div className="mt-3 max-h-[400px] overflow-y-auto rounded-md border border-neutral-200 p-4 dark:border-neutral-700">
            <InlineDiff
              oldText={diffSnapshot.content}
              newText={chapter?.content ?? ""}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
