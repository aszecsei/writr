"use client";

import { Modal } from "@/components/ui/Modal";

interface ImageLightboxProps {
  url: string;
  caption?: string;
  onClose: () => void;
}

export function ImageLightbox({ url, caption, onClose }: ImageLightboxProps) {
  return (
    <Modal onClose={onClose} variant="lightbox" maxWidth="max-w-[90vw]">
      {/* biome-ignore lint/performance/noImgElement: external URLs */}
      <img
        src={url}
        alt={caption ?? ""}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
      />
      {caption && (
        <p className="mt-3 max-w-xl text-center text-sm text-white/80">
          {caption}
        </p>
      )}
    </Modal>
  );
}
