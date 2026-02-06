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
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Backup & Restore
      </h3>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <Download size={16} />
          {isExporting ? "Exporting..." : "Export All Data"}
        </button>

        <button
          type="button"
          onClick={handleImportClick}
          className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
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

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Export creates a JSON file with all your projects and settings. You can
        import this backup to restore your data.
      </p>
    </div>
  );
}
