export type FountainElementType =
  | "scene_heading"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition"
  | "centered"
  | "page_break";

export interface FountainElement {
  type: FountainElementType;
  text: string;
  sceneNumber?: string;
  dual?: "left" | "right";
}
