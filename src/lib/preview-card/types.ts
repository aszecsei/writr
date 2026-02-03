export type CardTemplate =
  | "minimal"
  | "dramatic"
  | "vintage"
  | "christmas"
  | "valentine"
  | "halloween"
  | "asexual"
  | "trans"
  | "rainbow";
export type CardAspectRatio = "square" | "landscape" | "portrait";

export interface PreviewCardOptions {
  selectedText: string;
  projectTitle: string;
  chapterTitle: string;
  template: CardTemplate;
  aspectRatio: CardAspectRatio;
}
