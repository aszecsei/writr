"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { DialogFooter } from "@/components/ui/DialogFooter";
import {
  BUTTON_CANCEL,
  BUTTON_PRIMARY,
  INPUT_CLASS,
  LABEL_CLASS,
} from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { updateChapter } from "@/db/operations";
import type { ChapterId } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useChapter } from "@/hooks/data/useChapter";
import { summarizeChapter } from "@/lib/ai/client";
import { getTerm } from "@/lib/terminology";
import { useProjectStore } from "@/store/projectStore";
import { isChapterPropertiesModal, useUiStore } from "@/store/uiStore";

export function ChapterPropertiesDialog() {
  const modal = useUiStore((s) => s.modal);
  // Safe early return: the outer component runs no hooks after this point.
  if (!isChapterPropertiesModal(modal)) return null;
  return <ChapterPropertiesDialogInner chapterId={modal.chapterId} />;
}

function ChapterPropertiesDialogInner({ chapterId }: { chapterId: ChapterId }) {
  const chapter = useChapter(chapterId);
  const settings = useAppSettings();
  const closeModal = useUiStore((s) => s.closeModal);
  const activeProjectMode = useProjectStore((s) => s.activeProjectMode);

  const [synopsis, setSynopsis] = useState("");
  const [staged, setStaged] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the edit buffer once from the live chapter (the live query resolves
  // after first render). Later live updates must not clobber the user's edits.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && chapter) {
      setSynopsis(chapter.synopsis);
      seeded.current = true;
    }
  }, [chapter]);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const term = getTerm(activeProjectMode, "chapter");
  const apiKey = settings ? settings.providerApiKeys[settings.aiProvider] : "";
  const showAi = !!settings?.enableAiFeatures;
  const canGenerate =
    !loading && !!apiKey && !!chapter?.content.trim() && !!settings;

  async function handleGenerate() {
    if (!chapter || !settings || !apiKey) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await summarizeChapter(
        chapter.title,
        chapter.content,
        {
          apiKey,
          model: settings.providerModels[settings.aiProvider],
          provider: settings.aiProvider,
        },
        controller.signal,
      );
      setStaged(result.trim());
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Failed to generate summary",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOverwrite() {
    setSynopsis(staged ?? "");
    setStaged(null);
  }

  function handlePrepend() {
    if (staged === null) return;
    setSynopsis(synopsis ? `${staged}\n\n${synopsis}` : staged);
    setStaged(null);
  }

  async function handleSave() {
    await updateChapter(chapterId, { synopsis: synopsis.trim() });
    closeModal();
  }

  return (
    <Modal onClose={closeModal} maxWidth="max-w-lg" title={`${term} Summary`}>
      <AutoResizeTextarea
        label="Summary"
        labelClassName={LABEL_CLASS}
        className={INPUT_CLASS}
        value={synopsis}
        onChange={(e) => setSynopsis(e.target.value)}
        minRows={4}
        maxRows={12}
        placeholder={`A short summary of this ${term.toLowerCase()}…`}
        disabled={loading}
      />

      {showAi && (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Generate with AI
          </button>
          {!apiKey && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Add an API key for the active provider in settings to enable
              generation.
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}

          {staged !== null && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
              <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Suggested summary
              </p>
              <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">
                {staged}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleOverwrite}
                  className={BUTTON_PRIMARY}
                >
                  Overwrite
                </button>
                <button
                  type="button"
                  onClick={handlePrepend}
                  className={BUTTON_CANCEL}
                >
                  Prepend
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <DialogFooter
          onCancel={closeModal}
          submitLabel="Save"
          submitType="button"
          onSubmit={handleSave}
          submitDisabled={loading}
        />
      </div>
    </Modal>
  );
}
