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
    scene: "Scene",
    scenes: "Scenes",
    addScene: "Add Scene",
    untitledScene: "Untitled Scene",
  },
  screenplay: {
    chapter: "Sequence",
    chapters: "Sequences",
    addChapter: "Add Sequence",
    untitledChapter: "Untitled Sequence",
    book: "Screenplay",
    entireBook: "Entire Screenplay",
    currentChapter: "Current Sequence",
    // A screenplay "scene" already means a slugline/scene-heading, so the
    // Model-D subdivision uses the screenwriting term "Beat" to avoid collision.
    scene: "Beat",
    scenes: "Beats",
    addScene: "Add Beat",
    untitledScene: "Untitled Beat",
  },
} as const;

export type TermKey = keyof (typeof TERMS)["prose"];

export function getTerm(mode: ProjectMode | null, key: TermKey): string {
  return TERMS[mode ?? "prose"][key];
}
