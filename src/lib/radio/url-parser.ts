import type { TrackSource } from "@/db/schemas";

const YOUTUBE_PATTERNS = [
  /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/,
  /^https?:\/\/(?:www\.)?youtube\.com\/embed\/[\w-]+/,
  /^https?:\/\/youtu\.be\/[\w-]+/,
  /^https?:\/\/(?:www\.)?youtube\.com\/shorts\/[\w-]+/,
  /^https?:\/\/music\.youtube\.com\/watch\?v=[\w-]+/,
];

export type ParsedTrackUrl = {
  source: TrackSource;
  url: string;
};

/**
 * Parses a URL to determine if it's a supported YouTube track.
 * Returns the source type and normalized URL, or null if not supported.
 */
export function parseTrackUrl(url: string): ParsedTrackUrl | null {
  const trimmedUrl = url.trim();

  for (const pattern of YOUTUBE_PATTERNS) {
    if (pattern.test(trimmedUrl)) {
      return {
        source: "youtube",
        url: trimmedUrl,
      };
    }
  }

  return null;
}

/**
 * Extracts YouTube video ID from various URL formats.
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([\w-]+)/,
    /youtu\.be\/([\w-]+)/,
    /embed\/([\w-]+)/,
    /shorts\/([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}
