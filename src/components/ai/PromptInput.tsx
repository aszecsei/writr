"use client";

import { ArrowUp, ImagePlus, Square, X } from "lucide-react";
import type { FormEvent } from "react";

export interface PendingImage {
  url: string;
  alt?: string;
}

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel?: () => void;
  loading: boolean;
  selectedText?: string | null;
  onClearSelection?: () => void;
  pendingImages: PendingImage[];
  onAddImage: (image: PendingImage) => void;
  onRemoveImage: (index: number) => void;
  onOpenImagePicker: () => void;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  loading,
  selectedText,
  onClearSelection,
  pendingImages,
  onRemoveImage,
  onOpenImagePicker,
}: PromptInputProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-neutral-200 p-3 dark:border-neutral-800"
    >
      {selectedText && (
        <div className="mb-2 flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <span className="min-w-0 flex-1 truncate">
            Selection: &ldquo;{selectedText.slice(0, 80)}
            {selectedText.length > 80 ? "..." : ""}&rdquo;
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="shrink-0 rounded p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900"
            title="Clear selection"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {pendingImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingImages.map((img, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: index needed for removal
              key={i}
              className="group relative overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700"
            >
              {/* biome-ignore lint/performance/noImgElement: external/base64 URLs */}
              <img
                src={img.url}
                alt={img.alt ?? "Attached"}
                className="h-14 w-14 object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveImage(i)}
                className="absolute -right-0.5 -top-0.5 rounded-full bg-neutral-800/70 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Remove image"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onOpenImagePicker}
          disabled={loading}
          title="Attach image"
          className="rounded-md border border-neutral-300 p-2 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        >
          <ImagePlus size={16} />
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            selectedText ? "Ask about the selected text..." : "Ask the AI..."
          }
          disabled={loading}
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        {loading ? (
          <button
            type="button"
            onClick={onCancel}
            title="Cancel request"
            className="rounded-md bg-red-600 p-2 text-white transition-all duration-150 hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-400 dark:bg-red-500 dark:hover:bg-red-600"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim() && pendingImages.length === 0}
            title="Send message"
            className="rounded-md bg-primary-600 p-2 text-white transition-all duration-150 hover:bg-primary-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary-400 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
          >
            <ArrowUp size={16} />
          </button>
        )}
      </div>
    </form>
  );
}
