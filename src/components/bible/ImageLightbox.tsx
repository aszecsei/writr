"use client";

import { X } from "lucide-react";
import { useCallback, useEffect } from "react";

interface ImageLightboxProps {
  url: string;
  caption?: string;
  onClose: () => void;
}

export function ImageLightbox({ url, caption, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-md p-2 text-white/70 transition-colors hover:text-white"
        aria-label="Close"
      >
        <X size={24} />
      </button>
      {/* biome-ignore lint/performance/noImgElement: external URLs */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only */}
      <img
        src={url}
        alt={caption ?? ""}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {caption && (
        <p className="mt-3 max-w-xl text-center text-sm text-white/80">
          {caption}
        </p>
      )}
    </div>
  );
}
