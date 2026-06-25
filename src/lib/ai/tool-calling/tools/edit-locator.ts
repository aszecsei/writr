import { match } from "ts-pattern";
import {
  normalizedIndexOf,
  normalizePunctuation,
} from "@/lib/punctuation-match";

export interface ResolvedRange {
  from: number;
  to: number;
}

/**
 * The locating fields a chat-mode proposed edit carries. `locateProposedEdit`
 * reads only these, so any shape that structurally satisfies `EditLocator`
 * (e.g. the editor store's `PendingStagedEdit`) can be located — keeping a
 * single source of truth for where an edit lands.
 */
export interface EditLocator {
  kind: "replace" | "insert_at" | "append" | "full_chapter";
  anchorText?: string;
  prefix?: string;
  suffix?: string;
  fromOffset?: number;
}

/**
 * Splice `newContent` into `content` over a resolved range. Keeps the splice
 * arithmetic in one place for the chat-mode Apply consumer.
 */
export function spliceEdit(
  content: string,
  range: ResolvedRange,
  newContent: string,
): string {
  return content.slice(0, range.from) + newContent + content.slice(range.to);
}

/**
 * Resolve a proposed edit's range against the given chapter content.
 * Returns null if the locator can't be matched (anchor drift, missing anchor).
 *
 * Used by the chat-mode Apply consumer in `ChapterEditor`. For `insert_at`,
 * prefers the recorded offset when it still matches the anchor and falls back
 * to indexOf otherwise.
 */
export function locateProposedEdit(
  content: string,
  edit: EditLocator,
): ResolvedRange | null {
  return match(edit)
    .with({ kind: "full_chapter" }, () => ({ from: 0, to: content.length }))
    .with({ kind: "append" }, () => ({
      from: content.length,
      to: content.length,
    }))
    .with({ kind: "insert_at" }, (e): ResolvedRange | null => {
      if (
        typeof e.fromOffset === "number" &&
        e.fromOffset >= 0 &&
        e.fromOffset <= content.length
      ) {
        if (!e.anchorText) {
          return { from: e.fromOffset, to: e.fromOffset };
        }
        const slice = content.slice(
          e.fromOffset,
          e.fromOffset + e.anchorText.length,
        );
        if (
          normalizePunctuation(slice) === normalizePunctuation(e.anchorText)
        ) {
          return { from: e.fromOffset, to: e.fromOffset };
        }
      }
      if (e.anchorText) {
        const idx = normalizedIndexOf(content, e.anchorText);
        if (idx >= 0) return { from: idx, to: idx };
      }
      return null;
    })
    .with({ kind: "replace" }, (e): ResolvedRange | null => {
      if (!e.anchorText) return null;
      // Uniqueness was the proposal-time guarantee; the chapter has likely
      // shifted by apply time, so first match is the best we can do.
      const combined = (e.prefix ?? "") + e.anchorText + (e.suffix ?? "");
      const idx = normalizedIndexOf(content, combined);
      if (idx < 0) return null;
      const from = idx + (e.prefix ?? "").length;
      return { from, to: from + e.anchorText.length };
    })
    .exhaustive();
}
