"use client";

import { AlertTriangle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import {
  type Backup,
  type ConflictResolution,
  type ImportResult,
  importBackup,
  isFullBackup,
} from "@/lib/backup";

interface ImportBackupDialogProps {
  backup: Backup;
  filename: string;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
}

export function ImportBackupDialog({
  backup,
  filename,
  onClose,
  onImportComplete,
}: ImportBackupDialogProps) {
  const [conflictResolution, setConflictResolution] =
    useState<ConflictResolution>("skip");
  const [restoreSettings, setRestoreSettings] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const isFull = isFullBackup(backup);
  const projectCount = isFull ? backup.projects.length : 1;
  const projectTitle = isFull ? null : backup.data.project.title;
  const hasSettings = isFull && backup.appSettings != null;

  async function handleImport() {
    setIsImporting(true);
    try {
      const importResult = await importBackup(backup, {
        conflictResolution,
        restoreSettings: isFull && restoreSettings,
      });
      setResult(importResult);
      onImportComplete(importResult);
    } catch (e) {
      setResult({
        success: false,
        projectsImported: 0,
        projectsSkipped: 0,
        projectsReplaced: 0,
        settingsRestored: false,
        errors: [e instanceof Error ? e.message : "Import failed"],
      });
    } finally {
      setIsImporting(false);
    }
  }

  if (result) {
    return (
      <Modal onClose={onClose} maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle
                className="mt-0.5 text-green-600 dark:text-green-400"
                size={20}
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 text-red-600 dark:text-red-400"
                size={20}
              />
            )}
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {result.success ? "Import Complete" : "Import Failed"}
              </h2>
              <div className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                {result.projectsImported > 0 && (
                  <p>
                    {result.projectsImported} project
                    {result.projectsImported !== 1 ? "s" : ""} imported
                    {result.projectsReplaced > 0 && (
                      <> ({result.projectsReplaced} replaced)</>
                    )}
                  </p>
                )}
                {result.projectsSkipped > 0 && (
                  <p>
                    {result.projectsSkipped} project
                    {result.projectsSkipped !== 1 ? "s" : ""} skipped (already
                    exist)
                  </p>
                )}
                {result.settingsRestored && <p>Settings restored</p>}
                {result.errors.map((error) => (
                  <p key={error} className="text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={BUTTON_PRIMARY}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Import Backup
      </h2>

      <div className="mt-4 space-y-4">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {filename}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {isFull ? "Full backup" : "Project backup"} from{" "}
            {new Date(backup.metadata.exportedAt).toLocaleDateString()}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {projectCount} project{projectCount !== 1 ? "s" : ""}
            {projectTitle && `: "${projectTitle}"`}
            {hasSettings && " + settings"}
          </p>
        </div>

        <div>
          <label
            htmlFor="conflict-resolution"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            If a project already exists:
          </label>
          <select
            id="conflict-resolution"
            value={conflictResolution}
            onChange={(e) =>
              setConflictResolution(e.target.value as ConflictResolution)
            }
            className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="skip">Skip (keep existing)</option>
            <option value="duplicate">Create a copy (new IDs)</option>
            <option value="replace">Replace (overwrite existing)</option>
          </select>
        </div>

        {conflictResolution === "replace" && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/30">
            <AlertTriangle
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              size={16}
            />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Replace will permanently delete all existing data for matching
              projects and replace it with data from the backup.
            </p>
          </div>
        )}

        {isFull && hasSettings && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={restoreSettings}
              onChange={(e) => setRestoreSettings(e.target.checked)}
              className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-500 dark:border-neutral-600 dark:bg-neutral-700 dark:focus:ring-neutral-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Restore app settings
            </span>
          </label>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className={BUTTON_CANCEL}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting}
            className={BUTTON_PRIMARY}
          >
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
