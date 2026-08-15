"use client";

import { BookOpen } from "lucide-react";
import { useState } from "react";

interface ProjectCoverProps {
  /** http(s) or `data:image/*` URL. "" renders the placeholder. */
  url: string;
  /** Used for the alt text. */
  title: string;
  /**
   * Sizing and chrome for the box, e.g. "w-20 rounded-lg border". Borders and
   * rounding are left to the caller so a flush-mounted cover can opt out.
   */
  className?: string;
  /**
   * Stretch to the parent's height instead of holding the 2:3 box. The crop
   * stays centred, so the image still reads as a portrait poster.
   */
  fill?: boolean;
}

/**
 * Project cover art, by default in a fixed 2:3 (portrait, book-cover) box.
 * Source images of any ratio are centre-cropped rather than re-encoded, so the
 * stored value is always the original.
 */
export function ProjectCover({
  url,
  title,
  className = "",
  fill = false,
}: ProjectCoverProps) {
  // Track which URL failed rather than a bare flag, so swapping the source
  // clears the error without an effect.
  const [erroredUrl, setErroredUrl] = useState<string | null>(null);

  const showPlaceholder = !url || erroredUrl === url;

  // The contents are absolutely positioned so the crop fills the box in both
  // modes — under `fill` the height comes from flex stretch, which a percentage
  // height on the image can't resolve against.
  return (
    <div
      className={`relative ${fill ? "h-full" : "aspect-[2/3]"} overflow-hidden bg-neutral-100 dark:bg-neutral-800 ${className}`}
    >
      {showPlaceholder ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-primary-900/40">
          <BookOpen
            size={20}
            className="text-primary-500/70 dark:text-primary-400/70"
          />
        </div>
      ) : (
        // biome-ignore lint/performance/noImgElement: external and data URLs
        <img
          src={url}
          alt={`${title} cover`}
          className="absolute inset-0 h-full w-full object-cover object-center"
          onError={() => setErroredUrl(url)}
        />
      )}
    </div>
  );
}
