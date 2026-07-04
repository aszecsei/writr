/**
 * Markdown-level splitting and reassembly of a chapter document at its Model-D
 * scene-break markers. A stored chapter is one markdown string; scenes are
 * delimited by `<hr data-type="sceneBreak" data-scene-id="…">` lines emitted by
 * the SceneBreak node's serializer. The content before the first marker is the
 * core scene (no marker).
 *
 * These are pure string transforms — the single source of truth for how a
 * chapter's prose is carved into and rebuilt from scenes. Position-precise
 * comment remapping is handled separately (see scene-surgery.ts), which parses
 * the reassembled content into a ProseMirror doc.
 */

/** Matches a serialized scene-break marker anywhere in the content. */
const MARKER_RE = /<hr\b[^>]*\bdata-type="sceneBreak"[^>]*>/g;

/** A chapter segment: the marker id that *precedes* it (null for the core). */
export interface RawSegment {
  /** sceneId of the marker before this segment; null for the leading core. */
  markerSceneId: string | null;
  /** The segment's markdown body, trimmed. */
  body: string;
}

function extractSceneId(marker: string): string | null {
  const m = /data-scene-id="([^"]*)"/.exec(marker);
  return m?.[1] ? m[1] : null;
}

/**
 * Split a chapter's markdown into ordered segments at its scene-break markers.
 * The first segment is always the core (markerSceneId null); each subsequent
 * segment carries the id of the marker that precedes it.
 */
export function splitSegments(content: string): RawSegment[] {
  const segments: RawSegment[] = [];
  let lastIndex = 0;
  let precedingSceneId: string | null = null;
  MARKER_RE.lastIndex = 0;
  let match: RegExpExecArray | null = MARKER_RE.exec(content);
  while (match !== null) {
    segments.push({
      markerSceneId: precedingSceneId,
      body: content.slice(lastIndex, match.index).trim(),
    });
    precedingSceneId = extractSceneId(match[0]);
    lastIndex = match.index + match[0].length;
    match = MARKER_RE.exec(content);
  }
  segments.push({
    markerSceneId: precedingSceneId,
    body: content.slice(lastIndex).trim(),
  });
  return segments;
}

/** An ordered scene for reassembly: its own id and its markdown body. */
export interface OrderedSegment {
  sceneId: string;
  body: string;
}

/** Serialize one scene-break marker for the given scene id. */
export function sceneBreakMarker(sceneId: string): string {
  return `<hr data-type="sceneBreak" data-scene-id="${sceneId}">`;
}

/**
 * Reassemble ordered segments into a chapter's markdown. The first segment is
 * the core and gets no marker; every subsequent segment is preceded by its own
 * scene-break marker. Empty bodies are preserved (an empty scene is valid).
 */
export function assembleSegments(segments: OrderedSegment[]): string {
  const parts: string[] = [];
  segments.forEach((seg, i) => {
    if (i === 0) {
      parts.push(seg.body);
    } else {
      parts.push(sceneBreakMarker(seg.sceneId));
      parts.push(seg.body);
    }
  });
  return parts
    .filter((p, i) => p.length > 0 || i === 0)
    .join("\n\n")
    .trim();
}

/**
 * Map a chapter's split segments onto its scene rows, resolving the core
 * segment (which has no marker) to the row whose id appears in no marker.
 * Returns ordered `{ sceneId, body }` for every scene in document order.
 *
 * Robustness: a marker whose id has no matching row, or a row with no matching
 * marker beyond the core, still round-trips — the reconcile engine cleans up
 * stray rows/markers on the next save.
 */
export function mapSegmentsToScenes(
  content: string,
  sceneIds: string[],
): OrderedSegment[] {
  const segments = splitSegments(content);
  const markerIds = new Set(
    segments
      .map((s) => s.markerSceneId)
      .filter((id): id is string => id !== null),
  );
  // The core row is the one scene id that no marker references.
  const coreId = sceneIds.find((id) => !markerIds.has(id)) ?? sceneIds[0] ?? "";
  return segments.map((seg) => ({
    sceneId: seg.markerSceneId ?? coreId,
    body: seg.body,
  }));
}
