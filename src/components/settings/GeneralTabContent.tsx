"use client";

import { useAppStats } from "@/hooks/useAppStats";
import { AppearanceSettings } from "./AppearanceSettings";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

interface GeneralTabContentProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  inputClass: string;
  labelClass: string;
}

export function GeneralTabContent({
  theme,
  onThemeChange,
  inputClass,
  labelClass,
}: GeneralTabContentProps) {
  const stats = useAppStats();

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Statistics
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <StatItem
            label="Projects"
            value={stats ? String(stats.projectCount) : "\u2014"}
          />
          <StatItem
            label="Chapters"
            value={stats ? String(stats.chapterCount) : "\u2014"}
          />
          <StatItem
            label="Total Words"
            value={stats ? stats.totalWordCount.toLocaleString() : "\u2014"}
          />
          <StatItem
            label="Characters"
            value={stats ? String(stats.characterCount) : "\u2014"}
          />
          <StatItem
            label="Database Size"
            value={
              stats
                ? stats.storageSizeBytes != null
                  ? stats.storageQuotaBytes != null
                    ? `${formatBytes(stats.storageSizeBytes)} / ${formatBytes(stats.storageQuotaBytes)} (${((stats.storageSizeBytes / stats.storageQuotaBytes) * 100).toFixed(1)}%)`
                    : formatBytes(stats.storageSizeBytes)
                  : "N/A"
                : "\u2014"
            }
          />
          <StatItem
            label="Last Backup"
            value={
              stats
                ? stats.lastExportedAt
                  ? formatRelativeDate(stats.lastExportedAt)
                  : "Never"
                : "\u2014"
            }
          />
        </div>
      </fieldset>

      <AppearanceSettings
        theme={theme}
        onThemeChange={onThemeChange}
        inputClass={inputClass}
        labelClass={labelClass}
      />
    </div>
  );
}
