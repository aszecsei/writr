"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { type Backup, downloadFullBackup, parseBackupFile } from "@/lib/backup";

interface BackupSettingsProps {
  onImportReady: (backup: Backup, filename: string) => void;
}

export function BackupSettings({ onImportReady }: BackupSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    try {
      await downloadFullBackup();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  function handleImportClick() {
    setError(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const backup = parseBackupFile(content);
        onImportReady(backup, file.name);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to read backup file",
        );
      }
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Backup & Restore
      </h3>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          <Download size={16} />
          {isExporting ? "Exporting..." : "Export All Data"}
        </button>

        <button
          type="button"
          onClick={handleImportClick}
          className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          <Upload size={16} />
          Import Backup
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Export creates a JSON file with all your projects and settings. You can
        import this backup to restore your data.
      </p>
    </div>
  );
}
