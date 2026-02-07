"use client";

import { History, Play, Timer } from "lucide-react";
import { useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import {
  INPUT_CLASS,
  RADIO_ACTIVE,
  RADIO_BASE,
  RADIO_INACTIVE,
} from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { useWritingSprint } from "@/hooks/useWritingSprint";
import { useProjectStore } from "@/store/projectStore";
import { useSprintStore } from "@/store/sprintStore";

const DURATION_PRESETS = [
  { label: "15 min", ms: 15 * 60 * 1000 },
  { label: "25 min", ms: 25 * 60 * 1000 },
  { label: "30 min", ms: 30 * 60 * 1000 },
  { label: "45 min", ms: 45 * 60 * 1000 },
  { label: "60 min", ms: 60 * 60 * 1000 },
];

export function SprintConfigDialog() {
  const configModalOpen = useSprintStore((s) => s.configModalOpen);
  const closeConfigModal = useSprintStore((s) => s.closeConfigModal);
  const openHistoryModal = useSprintStore((s) => s.openHistoryModal);
  const projectTitle = useProjectStore((s) => s.activeProjectTitle);

  const { start } = useWritingSprint();

  const [selectedDuration, setSelectedDuration] = useState(
    DURATION_PRESETS[1].ms,
  );
  const [customMinutes, setCustomMinutes] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [wordGoal, setWordGoal] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!configModalOpen) return null;

  const effectiveDuration = useCustom
    ? Number.parseInt(customMinutes, 10) * 60 * 1000
    : selectedDuration;

  const isValidDuration = useCustom
    ? !Number.isNaN(effectiveDuration) && effectiveDuration > 0
    : true;

  async function handleStart() {
    if (!isValidDuration) {
      setError("Please enter a valid duration.");
      return;
    }

    setError(null);
    const goal = wordGoal ? Number.parseInt(wordGoal, 10) : null;
    if (goal !== null && (Number.isNaN(goal) || goal < 0)) {
      setError("Please enter a valid word goal.");
      return;
    }

    try {
      await start(effectiveDuration, goal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start sprint");
    }
  }

  function handleViewHistory() {
    closeConfigModal();
    openHistoryModal();
  }

  return (
    <Modal onClose={closeConfigModal}>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        <Timer size={18} />
        Start Writing Sprint
      </h2>

      {projectTitle && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Project: {projectTitle}
        </p>
      )}

      <div className="mt-5 space-y-5">
        {/* Duration */}
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Duration
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.ms}
                type="button"
                onClick={() => {
                  setSelectedDuration(preset.ms);
                  setUseCustom(false);
                }}
                className={`${RADIO_BASE} ${!useCustom && selectedDuration === preset.ms ? RADIO_ACTIVE : RADIO_INACTIVE}`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className={`${RADIO_BASE} ${useCustom ? RADIO_ACTIVE : RADIO_INACTIVE}`}
            >
              Custom
            </button>
          </div>
          {useCustom && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="180"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                placeholder="Minutes"
                className={`w-24 ${INPUT_CLASS}`}
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                minutes
              </span>
            </div>
          )}
        </fieldset>

        {/* Word Goal */}
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Word Goal (optional)
          </legend>
          <div className="mt-2">
            <input
              type="number"
              min="0"
              value={wordGoal}
              onChange={(e) => setWordGoal(e.target.value)}
              placeholder="e.g., 500"
              className={`w-32 ${INPUT_CLASS}`}
            />
          </div>
        </fieldset>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Actions */}
        <DialogFooter
          onCancel={closeConfigModal}
          submitDisabled={!isValidDuration}
          submitType="button"
          onSubmit={handleStart}
          submitClassName="flex items-center gap-2"
          submitChildren={
            <>
              <Play size={14} />
              Start Sprint
            </>
          }
          left={
            <button
              type="button"
              onClick={handleViewHistory}
              className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              <History size={14} />
              View History
            </button>
          }
        />
      </div>
    </Modal>
  );
}
