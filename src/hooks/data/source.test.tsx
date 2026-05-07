// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DataSourceProvider } from "@/context/DataSourceContext";
import type {
  Chapter,
  ChapterId,
  Character,
  CharacterId,
  ProjectId,
} from "@/db/schemas";
import { useSharedProjectStore } from "@/store/sharedProjectStore";
import {
  useChapter,
  useChaptersByProject,
  useCharactersByProject,
} from "./source";

const PROJECT_ID = "00000000-0000-4000-8000-0000000000aa" as ProjectId;
const CHAPTER_ID_1 = "00000000-0000-4000-8000-000000000001" as ChapterId;
const CHAPTER_ID_2 = "00000000-0000-4000-8000-000000000002" as ChapterId;
const CHARACTER_ID_1 = "00000000-0000-4000-8000-000000000011" as CharacterId;
const NOW = "2026-05-06T12:00:00.000Z";

function chapter(
  id: ChapterId,
  order = 0,
  title = `Ch ${id.slice(-1)}`,
): Chapter {
  return {
    id,
    projectId: PROJECT_ID,
    title,
    order,
    content: "",
    synopsis: "",
    status: "draft",
    wordCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function character(id: CharacterId, name = "Alice"): Character {
  return {
    id,
    projectId: PROJECT_ID,
    name,
    role: "protagonist",
    pronouns: "",
    aliases: [],
    description: "",
    personality: "",
    motivations: "",
    internalConflict: "",
    strengths: "",
    weaknesses: "",
    characterArcs: "",
    dialogueStyle: "",
    backstory: "",
    notes: "",
    linkedCharacterIds: [],
    linkedLocationIds: [],
    images: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const SharedWrapper = ({ children }: { children: ReactNode }) => (
  <DataSourceProvider source={{ kind: "shared", roomUuid: "r-1" }}>
    {children}
  </DataSourceProvider>
);

beforeEach(() => {
  useSharedProjectStore.getState().resetForRoom();
});
afterEach(() => {
  useSharedProjectStore.getState().resetForRoom();
});

describe("source-aware hooks (shared mode)", () => {
  it("useChapter reads from sharedProjectStore", () => {
    const ch = chapter(CHAPTER_ID_1);
    useSharedProjectStore.getState().upsertEntity("chapters", ch);

    const { result } = renderHook(() => useChapter(CHAPTER_ID_1), {
      wrapper: SharedWrapper,
    });
    expect(result.current).toEqual(ch);
  });

  it("useChaptersByProject filters by projectId and sorts by order", () => {
    useSharedProjectStore
      .getState()
      .upsertEntity("chapters", chapter(CHAPTER_ID_1, 2));
    useSharedProjectStore
      .getState()
      .upsertEntity("chapters", chapter(CHAPTER_ID_2, 1));

    const { result } = renderHook(() => useChaptersByProject(PROJECT_ID), {
      wrapper: SharedWrapper,
    });
    const arr = result.current as Chapter[];
    expect(arr.map((c) => c.id)).toEqual([CHAPTER_ID_2, CHAPTER_ID_1]);
  });

  it("useCharactersByProject sorts by name in shared mode", () => {
    useSharedProjectStore
      .getState()
      .upsertEntity("characters", character(CHARACTER_ID_1, "Bob"));
    const id2 = "00000000-0000-4000-8000-000000000012";
    useSharedProjectStore
      .getState()
      .upsertEntity("characters", character(id2, "Alice"));

    const { result } = renderHook(() => useCharactersByProject(PROJECT_ID), {
      wrapper: SharedWrapper,
    });
    const arr = result.current as Character[];
    expect(arr.map((c) => c.name)).toEqual(["Alice", "Bob"]);
  });

  it("returns [] for project list with null projectId in shared mode", () => {
    const { result } = renderHook(() => useChaptersByProject(null), {
      wrapper: SharedWrapper,
    });
    expect(result.current).toEqual([]);
  });
});
