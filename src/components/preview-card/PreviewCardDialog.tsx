"use client";

import { Download, ImagePlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import {
  BUTTON_CANCEL,
  BUTTON_PRIMARY,
  RADIO_ACTIVE,
  RADIO_BASE,
  RADIO_INACTIVE,
} from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import { useAppSettings } from "@/hooks/useAppSettings";
import { getEditorFont } from "@/lib/fonts";
import {
  downloadBlob,
  generatePreviewImage,
} from "@/lib/preview-card/generate";
import { ASPECT_RATIOS, TEMPLATES } from "@/lib/preview-card/templates";
import type { CardAspectRatio, CardTemplate } from "@/lib/preview-card/types";
import { isPreviewCardModal, useUiStore } from "@/store/uiStore";
import { PreviewCardCanvas } from "./PreviewCardCanvas";

const TEMPLATE_OPTIONS = (Object.keys(TEMPLATES) as CardTemplate[]).map(
  (key) => ({
    value: key,
    label: TEMPLATES[key].name,
  }),
);

const ASPECT_RATIO_OPTIONS = (
  Object.keys(ASPECT_RATIOS) as CardAspectRatio[]
).map((key) => ({
  value: key,
  label: ASPECT_RATIOS[key].label,
}));

export function PreviewCardDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const settings = useAppSettings();
  const editorFont = getEditorFont(settings?.editorFont ?? "literata");

  const [template, setTemplate] = useState<CardTemplate>("minimal");
  const [aspectRatio, setAspectRatio] = useState<CardAspectRatio>("square");
  const [showWorkTitle, setShowWorkTitle] = useState(true);
  const [showChapterTitle, setShowChapterTitle] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  if (!isPreviewCardModal(modal)) return null;

  const { selectedHtml, projectTitle, chapterTitle } = modal;

  if (!selectedHtml) {
    return (
      <Modal onClose={closeModal}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <ImagePlus size={18} />
          Preview Card
        </h2>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Select some text in the editor to create a preview card.
        </p>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={closeModal} className={BUTTON_CANCEL}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

  async function handleDownload() {
    if (!canvasRef.current) return;

    setGenerating(true);
    setError(null);

    try {
      const blob = await generatePreviewImage(canvasRef.current);
      const filename = `${projectTitle.toLowerCase().replace(/\s+/g, "-")}-preview.png`;
      downloadBlob(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal onClose={closeModal} maxWidth="max-w-2xl">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        <ImagePlus size={18} />
        Preview Card
      </h2>

      <div className="mt-5 space-y-5">
        <div className="flex justify-center rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
          <PreviewCardCanvas
            ref={canvasRef}
            selectedHtml={selectedHtml}
            projectTitle={projectTitle}
            chapterTitle={chapterTitle}
            template={template}
            aspectRatio={aspectRatio}
            fontFamily={editorFont.cssFamily}
            showWorkTitle={showWorkTitle}
            showChapterTitle={showChapterTitle}
          />
        </div>

        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Template
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TEMPLATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTemplate(opt.value)}
                className={`${RADIO_BASE} ${template === opt.value ? RADIO_ACTIVE : RADIO_INACTIVE}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Aspect Ratio
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ASPECT_RATIO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAspectRatio(opt.value)}
                className={`${RADIO_BASE} ${aspectRatio === opt.value ? RADIO_ACTIVE : RADIO_INACTIVE}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Attribution
          </legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={showWorkTitle}
                onChange={(e) => setShowWorkTitle(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
              />
              Work title
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={showChapterTitle}
                onChange={(e) => setShowChapterTitle(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
              />
              Chapter title
            </label>
          </div>
        </fieldset>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={closeModal} className={BUTTON_CANCEL}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={generating}
            className={`flex items-center gap-2 ${BUTTON_PRIMARY}`}
          >
            {generating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download size={14} />
                Download
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
