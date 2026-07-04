import type { z } from "zod";
import type { ToolResult } from "../types";

export function ok(
  message: string,
  data?: Record<string, unknown>,
): ToolResult {
  return { success: true, message, data };
}

export function fail(message: string): ToolResult {
  return { success: false, message };
}

/**
 * Compute a new ordering after moving one id to sit immediately before or
 * after a target id. `orderedIds` is the current order; `moveId` and
 * `targetId` must both be present and distinct — callers validate that and
 * surface friendly errors. Pure: the caller persists the result via the
 * entity's reorder operation.
 */
export function reorderRelative<T extends string>(
  orderedIds: readonly T[],
  moveId: T,
  targetId: T,
  position: "before" | "after",
): T[] {
  const without = orderedIds.filter((id) => id !== moveId);
  const targetIndex = without.indexOf(targetId);
  const insertIndex = position === "before" ? targetIndex : targetIndex + 1;
  without.splice(insertIndex, 0, moveId);
  return without;
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) =>
      i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
    )
    .join("; ");
}

export function splitParagraphs(content: string): string[] {
  return content.split(/\n\n+/).filter((p) => p.trim());
}

/**
 * Detects a scene break in a stored chapter paragraph. Matches both
 * markdown-style thematic breaks (`---`, `***`, `___`, or spaced `* * *`) —
 * for authors who type a plain break without opting into Model-D scenes — and
 * Writr's own scene-break marker (`<hr data-type="sceneBreak" …>`, serialized
 * by the SceneBreak node). Anchored to the whole (optionally padded) paragraph.
 */
export const SCENE_BREAK_RE = /^\s*(?:[-*_]\s*){3,}$|^\s*<hr\b[^>]*>\s*$/i;
