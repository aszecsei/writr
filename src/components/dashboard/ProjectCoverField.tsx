"use client";

import { Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { ProjectCover } from "@/components/ui/ProjectCover";
import { isSupportedImageSource } from "@/db/schemas";
import { formatBytes } from "@/lib/format-bytes";
import {
  estimateDataUrlBytes,
  readFileAsDataUrl,
} from "@/lib/images/readFileAsDataUrl";

/**
 * Above this, an uploaded cover starts meaningfully bloating collab syncs and
 * backup files, since the whole project row is serialized into both.
 */
const LARGE_COVER_BYTES = 1024 * 1024;

interface ProjectCoverFieldProps {
  /** "" means no cover. */
  value: string;
  onChange: (value: string) => void;
}

const isDataUrlValue = (value: string) => value.startsWith("data:");

/** An uploaded image is summarized rather than dumped into the text input. */
const toUrlDraft = (value: string) => (isDataUrlValue(value) ? "" : value);

export function ProjectCoverField({ value, onChange }: ProjectCoverFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  // Local draft so a half-typed URL never reaches the parent form state; only
  // values that pass validation are propagated.
  const [urlDraft, setUrlDraft] = useState(() => toUrlDraft(value));

  const isDataUrl = isDataUrlValue(value);

  // Resync when the form seeds a different project, or an upload/removal
  // replaces the value from outside this component.
  useEffect(() => {
    setUrlDraft(toUrlDraft(value));
  }, [value]);

  const isDraftValid = isSupportedImageSource(urlDraft.trim());

  function handleUrlChange(next: string) {
    setUrlDraft(next);
    setUploadError("");
    const trimmed = next.trim();
    if (isSupportedImageSource(trimmed)) onChange(trimmed);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    e.target.value = "";
    if (!file) return;

    setUploadError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (!isSupportedImageSource(dataUrl)) {
        throw new Error(
          `"${file.name}" is not a supported image type (expected an image/* file).`,
        );
      }
      onChange(dataUrl);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to read image file",
      );
    }
  }

  function handleRemove() {
    setUploadError("");
    onChange("");
  }

  const uploadedBytes = isDataUrl ? estimateDataUrlBytes(value) : 0;

  return (
    <div>
      <span className={LABEL_CLASS}>Cover</span>
      <div className="mt-1 flex gap-3">
        <ProjectCover
          url={value}
          title="Project"
          className="w-20 shrink-0 self-start rounded-lg border border-neutral-200 dark:border-neutral-800"
        />
        <div className="min-w-0 flex-1">
          {isDataUrl ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Uploaded image ({formatBytes(uploadedBytes)})
            </p>
          ) : (
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/cover.jpg"
              className={`${INPUT_CLASS} mt-0`}
              aria-label="Cover image URL"
            />
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Upload size={13} />
              Upload
            </button>
            {value && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <Trash2 size={13} />
                Remove
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {!isDraftValid && (
            <p className="mt-1.5 text-xs text-red-500">
              Enter an http(s) URL, or upload a file.
            </p>
          )}
          {uploadError && (
            <p className="mt-1.5 text-xs text-red-500">{uploadError}</p>
          )}
          {uploadedBytes > LARGE_COVER_BYTES && (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-500">
              Large image — it is stored in full inside the project, so it will
              also be included in every backup and collaboration sync.
            </p>
          )}
          <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
            Shown cropped to 2:3 (portrait).
          </p>
        </div>
      </div>
    </div>
  );
}
