"use client";

import type {
  EditorWidth,
  NeutralColor,
  PrimaryColor,
  UiDensity,
} from "@/db/schemas";
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
    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/50">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
    </div>
  );
}

interface GeneralTabContentProps {
  theme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  primaryColor: PrimaryColor;
  onPrimaryColorChange: (color: PrimaryColor) => void;
  neutralColor: NeutralColor;
  onNeutralColorChange: (color: NeutralColor) => void;
  editorWidth: EditorWidth;
  onEditorWidthChange: (width: EditorWidth) => void;
  uiDensity: UiDensity;
  onUiDensityChange: (density: UiDensity) => void;
  inputClass: string;
  labelClass: string;
}

export function GeneralTabContent({
  theme,
  onThemeChange,
  primaryColor,
  onPrimaryColorChange,
  neutralColor,
  onNeutralColorChange,
  editorWidth,
  onEditorWidthChange,
  uiDensity,
  onUiDensityChange,
  inputClass,
  labelClass,
}: GeneralTabContentProps) {
  const stats = useAppStats();

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
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
        primaryColor={primaryColor}
        onPrimaryColorChange={onPrimaryColorChange}
        neutralColor={neutralColor}
        onNeutralColorChange={onNeutralColorChange}
        editorWidth={editorWidth}
        onEditorWidthChange={onEditorWidthChange}
        uiDensity={uiDensity}
        onUiDensityChange={onUiDensityChange}
        inputClass={inputClass}
        labelClass={labelClass}
      />
    </div>
  );
}
