import { extractYouTubeId } from "./url-parser";

export interface TrackMetadata {
  title: string;
  thumbnailUrl: string;
  duration: number; // in seconds, 0 if unknown
}

/**
 * Fetches metadata for a YouTube video using oEmbed API.
 */
export async function fetchTrackMetadata(url: string): Promise<TrackMetadata> {
  const videoId = extractYouTubeId(url);

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      throw new Error(`YouTube oEmbed failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      title: data.title || "Unknown Track",
      thumbnailUrl: videoId
        ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        : data.thumbnail_url || "",
      duration: 0, // oEmbed doesn't provide duration
    };
  } catch {
    // Fallback to basic info
    return {
      title: videoId ? `YouTube Video (${videoId})` : "YouTube Video",
      thumbnailUrl: videoId
        ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        : "",
      duration: 0,
    };
  }
}
