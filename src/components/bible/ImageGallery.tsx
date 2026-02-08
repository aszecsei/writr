"use client";

import { ImagePlus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import type { EntityImage } from "@/db/schemas";
import { AddImageDialog } from "./AddImageDialog";
import { ImageLightbox } from "./ImageLightbox";

interface ImageGalleryProps {
  images: EntityImage[];
  onAddImage: (image: EntityImage) => void;
  onRemoveImage: (imageId: string) => void;
  onSetPrimary: (imageId: string) => void;
}

export function ImageGallery({
  images,
  onAddImage,
  onRemoveImage,
  onSetPrimary,
}: ImageGalleryProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<EntityImage | null>(null);

  function handleAdd(url: string, caption: string) {
    onAddImage({
      id: crypto.randomUUID(),
      url,
      caption,
      isPrimary: images.length === 0,
    });
  }

  return (
    <div>
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <button
                type="button"
                onClick={() => setLightboxImage(img)}
                className="block aspect-square w-full"
              >
                {/* biome-ignore lint/performance/noImgElement: external URLs */}
                <img
                  src={img.url}
                  alt={img.caption}
                  className="h-full w-full object-cover"
                />
              </button>
              {/* Primary badge */}
              {img.isPrimary && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
                  <Star size={10} fill="currentColor" />
                  Primary
                </span>
              )}
              {/* Actions overlay */}
              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
              {/* Caption */}
              {img.caption && (
                <p className="truncate px-2 py-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  {img.caption}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowAddDialog(true)}
        className="mt-3 flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-300"
      >
        <ImagePlus size={14} />
        Add Image
      </button>
      {showAddDialog && (
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
