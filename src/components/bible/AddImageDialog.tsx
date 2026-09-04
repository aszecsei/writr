"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { describeImage } from "@/lib/ai/client";

interface AddImageDialogProps {
  onAdd: (url: string, caption: string) => void;
  onClose: () => void;
}

export function AddImageDialog({ onAdd, onClose }: AddImageDialogProps) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const settings = useAppSettings();

  const isValidUrl = url.trim().length > 0;

  const showAiButton =
    settings?.enableAiFeatures &&
    isValidUrl &&
    settings.providerApiKeys[settings.aiProvider];

  function handleAdd() {
    if (!isValidUrl) return;
    onAdd(url.trim(), caption.trim());
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  async function handleDescribe() {
    if (!settings) return;
    setIsGenerating(true);
    setGenerateError("");
    try {
      const result = await describeImage(url.trim(), {
        apiKey: settings.providerApiKeys[settings.aiProvider],
        model: settings.providerModels[settings.aiProvider],
        provider: settings.aiProvider,
      });
      setCaption(result);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Failed to describe image",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" title="Add Image">
      <div className="space-y-4">
        <label className={LABEL_CLASS}>
          Image URL
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreviewError(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/image.jpg"
            className={INPUT_CLASS}
          />
        </label>
        <div>
          <div className="flex items-center gap-2">
            <label className={`flex-1 ${LABEL_CLASS}`}>
              Caption (optional)
              <input
                type="text"
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setGenerateError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Description of the image..."
                className={INPUT_CLASS}
              />
            </label>
            {showAiButton && (
              <button
                type="button"
                onClick={handleDescribe}
                disabled={isGenerating}
                title="Generate caption with AI"
                className="mt-5 shrink-0 rounded-md border border-neutral-300 p-2 text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                {isGenerating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
              </button>
            )}
          </div>
          {generateError && (
            <p className="mt-1 text-xs text-red-500">{generateError}</p>
          )}
        </div>
        {isValidUrl && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
            <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Preview
            </p>
            {previewError ? (
              <p className="text-xs text-red-500">
                Could not load image preview. The URL may still be valid.
              </p>
            ) : (
              // biome-ignore lint/performance/noImgElement: external URLs
              <img
                src={url}
                alt="Preview"
                className="max-h-48 rounded object-contain"
                onError={() => setPreviewError(true)}
              />
            )}
          </div>
        )}
        <div className="pt-2">
          <DialogFooter
            onCancel={onClose}
            submitLabel="Add Image"
            submitType="button"
            onSubmit={handleAdd}
            submitDisabled={!isValidUrl}
          />
        </div>
      </div>
    </Modal>
  );
}
