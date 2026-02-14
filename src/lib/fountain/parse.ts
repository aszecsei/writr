import { Fountain } from "fountain-js";
import type { FountainElement, FountainElementType } from "./types";

const ELEMENT_TYPES = new Set<string>([
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "centered",
  "page_break",
]);

interface FountainToken {
  type: string;
  text?: string;
  scene_number?: string;
  dual?: string;
}

/**
 * Parse Fountain plain text into a flat list of FountainElements.
 * Strips structural wrapper tokens (dialogue_begin/end, dual_dialogue_begin/end).
 */
export function parseFountain(text: string): FountainElement[] {
  const f = new Fountain();
  const result = f.parse(text, true);
  const tokens: FountainToken[] = result.tokens ?? [];

  const elements: FountainElement[] = [];
  let currentDual: "left" | "right" | undefined;

  for (const token of tokens) {
    // Track dual dialogue context
    if (token.type === "dialogue_begin") {
      currentDual =
        token.dual === "left" || token.dual === "right"
          ? token.dual
          : undefined;
      continue;
    }
    if (
      token.type === "dialogue_end" ||
      token.type === "dual_dialogue_begin" ||
      token.type === "dual_dialogue_end"
    ) {
      if (token.type === "dialogue_end") {
        currentDual = undefined;
      }
      continue;
    }

    if (!ELEMENT_TYPES.has(token.type)) continue;

    const el: FountainElement = {
      type: token.type as FountainElementType,
      text: token.text ?? "",
    };

    if (token.type === "scene_heading" && token.scene_number) {
      el.sceneNumber = token.scene_number;
    }

    if (
      currentDual &&
      (token.type === "character" ||
        token.type === "dialogue" ||
        token.type === "parenthetical")
    ) {
      el.dual = currentDual;
    }

    elements.push(el);
  }

  return elements;
}
