"use client";

import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import type {
  EditorWidth,
  GoalCountdownDisplay,
  NeutralColor,
  PrimaryColor,
  UiDensity,
} from "@/db/schemas";
import { useAppStats } from "@/hooks/editor/useAppStats";
import { formatBytes } from "@/lib/format-bytes";
import { formatRelativeTime } from "@/lib/format-time";
import { AppearanceSettings } from "./AppearanceSettings";
import type {
  AppSettingsDraft,
  SetAppSettingsField,
} from "./AppSettingsDialog";

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
  draft: AppSettingsDraft;
  setField: SetAppSettingsField;
  onPrimaryColorChange: (color: PrimaryColor) => void;
  onNeutralColorChange: (color: NeutralColor) => void;
  onEditorWidthChange: (width: EditorWidth) => void;
  onUiDensityChange: (density: UiDensity) => void;
}

export function GeneralTabContent({
  draft,
  setField,
  onPrimaryColorChange,
  onNeutralColorChange,
  onEditorWidthChange,
  onUiDensityChange,
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
                  ? formatRelativeTime(stats.lastExportedAt)
                  : "Never"
                : "\u2014"
            }
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Display
        </legend>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-4">
            <label
              htmlFor="goal-countdown"
              className={`${LABEL_CLASS} shrink-0`}
            >
              Goal countdown
            </label>
            <select
              id="goal-countdown"
              className={`${INPUT_CLASS} w-full`}
              value={draft.goalCountdownDisplay}
              onChange={(e) =>
                setField(
                  "goalCountdownDisplay",
                  e.target.value as GoalCountdownDisplay,
                )
              }
            >
              <option value="estimated-date">Estimated completion date</option>
              <option value="time-remaining">Time remaining</option>
              <option value="off">Off</option>
            </select>
          </div>
        </div>
      </fieldset>

      <AppearanceSettings
        draft={draft}
        setField={setField}
        onPrimaryColorChange={onPrimaryColorChange}
        onNeutralColorChange={onNeutralColorChange}
        onEditorWidthChange={onEditorWidthChange}
        onUiDensityChange={onUiDensityChange}
      />
    </div>
  );
}
