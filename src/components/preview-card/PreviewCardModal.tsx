"use client";

import { Download, ImagePlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  downloadBlob,
  generatePreviewImage,
} from "@/lib/preview-card/generate";
import { ASPECT_RATIOS, TEMPLATES } from "@/lib/preview-card/templates";
import type { CardAspectRatio, CardTemplate } from "@/lib/preview-card/types";
import { useUiStore } from "@/store/uiStore";
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

export function PreviewCardModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);

  const [template, setTemplate] = useState<CardTemplate>("minimal");
  const [aspectRatio, setAspectRatio] = useState<CardAspectRatio>("square");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  if (activeModal !== "preview-card") return null;

  const selectedText = (modalData.selectedText as string) ?? "";
  const projectTitle = (modalData.projectTitle as string) ?? "Untitled";
  const chapterTitle = (modalData.chapterTitle as string) ?? "";

  if (!selectedText) {
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
          <button
            type="button"
            onClick={closeModal}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
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

  const radioClass =
    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors";
  const radioActiveClass =
    "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
  const radioInactiveClass =
    "border-zinc-200 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600";

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
            selectedText={selectedText}
            projectTitle={projectTitle}
            chapterTitle={chapterTitle}
            template={template}
            aspectRatio={aspectRatio}
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
                className={`${radioClass} ${template === opt.value ? radioActiveClass : radioInactiveClass}`}
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
                className={`${radioClass} ${aspectRatio === opt.value ? radioActiveClass : radioInactiveClass}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={generating}
            className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
