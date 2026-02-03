export type CardTemplate = "minimal" | "dramatic" | "vintage";
export type CardAspectRatio = "square" | "landscape" | "portrait";

export interface PreviewCardOptions {
  selectedText: string;
  projectTitle: string;
  chapterTitle: string;
  template: CardTemplate;
  aspectRatio: CardAspectRatio;
}
