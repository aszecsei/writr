"use client";

import {
  Crosshair,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import type { EntityImage, EntityImageId } from "@/db/schemas";
import { computeFocalPoint } from "@/lib/images/focal-point";
import { AddImageDialog } from "./AddImageDialog";
import { ImageLightbox } from "./ImageLightbox";

interface ImageGalleryProps {
  images: EntityImage[];
  onAddImage: (image: EntityImage) => void;
  onRemoveImage: (imageId: EntityImageId) => void;
  onSetPrimary: (imageId: EntityImageId) => void;
  onUpdateImage: (imageId: EntityImageId, patch: Partial<EntityImage>) => void;
  /** When true, hide the Add / Remove / Set-primary affordances. The
   *  lightbox preview remains available so guests can still inspect
   *  images at full size. */
  readOnly?: boolean;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function ImageGallery({
  images,
  onAddImage,
  onRemoveImage,
  onSetPrimary,
  onUpdateImage,
  readOnly,
}: ImageGalleryProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<EntityImage | null>(null);
  const [editingFocalId, setEditingFocalId] = useState<EntityImageId | null>(
    null,
  );
  const [suggestingId, setSuggestingId] = useState<EntityImageId | null>(null);

  async function handleSuggestFocal(img: EntityImage) {
    setSuggestingId(img.id);
    try {
      const focal = await computeFocalPoint(img.url);
      if (focal) onUpdateImage(img.id, { focalX: focal.x, focalY: focal.y });
    } finally {
      setSuggestingId(null);
    }
  }

  function handleAdd(url: string, caption: string) {
    const id = crypto.randomUUID() as EntityImageId;
    onAddImage({
      id,
      url,
      caption,
      isPrimary: images.length === 0,
      focalX: 0.5,
      focalY: 0,
    });
    // Auto-suggest a focal point. Fails silently on cross-origin images
    // without CORS headers (canvas taint) — the default focal point stands.
    computeFocalPoint(url).then((focal) => {
      if (focal) onUpdateImage(id, { focalX: focal.x, focalY: focal.y });
    });
  }

  function handleTileClick(
    e: React.MouseEvent<HTMLButtonElement>,
    img: EntityImage,
  ) {
    if (editingFocalId !== img.id) {
      setLightboxImage(img);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    onUpdateImage(img.id, {
      focalX: clamp01((e.clientX - rect.left) / rect.width),
      focalY: clamp01((e.clientY - rect.top) / rect.height),
    });
  }

  return (
    <div>
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => {
            const isEditingFocal = editingFocalId === img.id;
            const focalX = img.focalX ?? 0.5;
            const focalY = img.focalY ?? 0;
            return (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <button
                  type="button"
                  onClick={(e) => handleTileClick(e, img)}
                  className={`relative block aspect-square w-full ${
                    isEditingFocal ? "cursor-crosshair" : ""
                  }`}
                  title={
                    isEditingFocal ? "Click to set the focal point" : undefined
                  }
                >
                  {/* biome-ignore lint/performance/noImgElement: external URLs */}
                  <img
                    src={img.url}
                    alt={img.caption}
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: `${focalX * 100}% ${focalY * 100}%`,
                    }}
                  />
                  {isEditingFocal && (
                    <>
                      <span className="pointer-events-none absolute inset-0 bg-black/20" />
                      <span
                        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary-500 shadow-md ring-2 ring-black/30"
                        style={{
                          left: `${focalX * 100}%`,
                          top: `${focalY * 100}%`,
                        }}
                      />
                    </>
                  )}
                </button>
                {/* Primary badge */}
                {img.isPrimary && (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
                    <Star size={10} fill="currentColor" />
                    Primary
                  </span>
                )}
                {/* Actions overlay */}
                {!readOnly && (
                  <div
                    className={`absolute right-1.5 top-1.5 flex gap-1 transition-opacity ${
                      isEditingFocal
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSuggestFocal(img)}
                      disabled={suggestingId === img.id}
                      title="Auto-suggest focal point"
                      className="rounded bg-black/60 p-1 text-white transition-colors hover:bg-black/80 disabled:opacity-60"
                    >
                      {suggestingId === img.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Wand2 size={12} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingFocalId(isEditingFocal ? null : img.id)
                      }
                      title={
                        isEditingFocal
                          ? "Done setting focal point"
                          : "Set focal point"
                      }
                      className={`rounded p-1 text-white transition-colors ${
                        isEditingFocal
                          ? "bg-primary-600 hover:bg-primary-700"
                          : "bg-black/60 hover:bg-black/80"
                      }`}
                    >
                      <Crosshair size={12} />
                    </button>
                    {!img.isPrimary && (
                      <button
                        type="button"
                        onClick={() => onSetPrimary(img.id)}
                        title="Set as primary"
                        className="rounded bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
                      >
                        <Star size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveImage(img.id)}
                      title="Remove image"
                      className="rounded bg-black/60 p-1 text-white transition-colors hover:bg-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                {/* Caption */}
                {img.caption && (
                  <p className="truncate px-2 py-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                    {img.caption}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setShowAddDialog(true)}
          className="mt-3 flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-300"
        >
          <ImagePlus size={14} />
          Add Image
        </button>
      )}
      {!readOnly && showAddDialog && (
        <AddImageDialog
          onAdd={handleAdd}
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {lightboxImage && (
        <ImageLightbox
          url={lightboxImage.url}
          caption={lightboxImage.caption}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
