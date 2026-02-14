import type { ProjectMode } from "@/db/schemas";

const TERMS = {
  prose: {
    chapter: "Chapter",
    chapters: "Chapters",
    addChapter: "Add Chapter",
    untitledChapter: "Untitled Chapter",
    book: "Book",
    entireBook: "Entire Book",
    currentChapter: "Current Chapter",
  },
  screenplay: {
    chapter: "Sequence",
    chapters: "Sequences",
    addChapter: "Add Sequence",
    untitledChapter: "Untitled Sequence",
    book: "Screenplay",
    entireBook: "Entire Screenplay",
    currentChapter: "Current Sequence",
  },
} as const;

export type TermKey = keyof (typeof TERMS)["prose"];

export function getTerm(mode: ProjectMode | null, key: TermKey): string {
  return TERMS[mode ?? "prose"][key];
}
