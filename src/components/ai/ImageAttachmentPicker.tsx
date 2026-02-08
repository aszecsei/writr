"use client";

import { Globe, ImageIcon, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { Character, EntityImage, Location } from "@/db/schemas";
import { Modal } from "../ui/Modal";
import type { PendingImage } from "./PromptInput";

type PickerTab = "gallery" | "url" | "upload";

interface ImageAttachmentPickerProps {
  characters: Character[];
  locations: Location[];
  onSelect: (image: PendingImage) => void;
  onClose: () => void;
}

export function ImageAttachmentPicker({
  characters,
  locations,
  onSelect,
  onClose,
}: ImageAttachmentPickerProps) {
  const [tab, setTab] = useState<PickerTab>("gallery");
  const [urlInput, setUrlInput] = useState("");
  const [urlPreviewError, setUrlPreviewError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collect all gallery images with entity labels
  const galleryImages: { image: EntityImage; entityName: string }[] = [];
  for (const char of characters) {
    for (const img of char.images ?? []) {
      galleryImages.push({ image: img, entityName: char.name });
    }
  }
  for (const loc of locations) {
    for (const img of loc.images ?? []) {
      galleryImages.push({ image: img, entityName: loc.name });
    }
  }

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput.trim()) return;
    onSelect({ url: urlInput.trim() });
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onSelect({ url: dataUrl, alt: file.name });
      onClose();
    };
    reader.readAsDataURL(file);
  }

  const tabs: { value: PickerTab; label: string; icon: typeof ImageIcon }[] = [
    { value: "gallery", label: "Gallery", icon: ImageIcon },
    { value: "url", label: "URL", icon: Globe },
    { value: "upload", label: "Upload", icon: Upload },
  ];

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <h3 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Attach Image
      </h3>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.value
                ? "border-b-2 border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Gallery tab */}
      {tab === "gallery" && (
        <div>
          {galleryImages.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
              No images in your story bible yet. Add images to characters or
              locations first.
            </p>
          ) : (
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
              {galleryImages.map(({ image, entityName }) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => {
                    onSelect({ url: image.url, alt: entityName });
                    onClose();
                  }}
                  className="group relative overflow-hidden rounded-lg border border-neutral-200 transition-colors hover:border-primary-400 dark:border-neutral-700"
                >
                  {/* biome-ignore lint/performance/noImgElement: external URLs */}
                  <img
                    src={image.url}
                    alt={image.caption || entityName}
                    className="aspect-square w-full object-cover"
                  />
                  <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1.5 py-1 text-[10px] text-white">
                    {entityName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* URL tab */}
      {tab === "url" && (
        <form onSubmit={handleUrlSubmit} className="space-y-3">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setUrlPreviewError(false);
            }}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          {urlInput.trim() && !urlPreviewError && (
            // biome-ignore lint/performance/noImgElement: external URLs
            <img
              src={urlInput}
              alt="Preview"
              className="max-h-32 rounded object-contain"
              onError={() => setUrlPreviewError(true)}
            />
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
            >
              Attach
            </button>
          </div>
        </form>
      )}

      {/* Upload tab */}
      {tab === "upload" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Select an image file to attach. It will be sent as base64 data.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
          >
            <Upload size={14} />
            Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}
    </Modal>
  );
}
