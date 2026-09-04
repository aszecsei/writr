// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DataSourceProvider } from "@/context/DataSourceContext";
import type { ChapterId, CharacterId, ProjectId } from "@/db/schemas";
import { useSharedProjectStore } from "@/store/sharedProjectStore";
import { makeChapter, makeCharacter } from "@/test/helpers";
import { useChaptersByProject, useCharactersByProject } from "./source";

const PROJECT_ID = "00000000-0000-4000-8000-0000000000aa" as ProjectId;
const CHAPTER_ID_1 = "00000000-0000-4000-8000-000000000001" as ChapterId;
const CHAPTER_ID_2 = "00000000-0000-4000-8000-000000000002" as ChapterId;
const CHARACTER_ID_1 = "00000000-0000-4000-8000-000000000011" as CharacterId;

const SharedWrapper = ({ children }: { children: ReactNode }) => (
  <DataSourceProvider source={{ kind: "shared" }}>
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
  it("useChaptersByProject filters by projectId and sorts by order", () => {
    useSharedProjectStore.getState().upsertEntity(
      "chapters",
      makeChapter({
        id: CHAPTER_ID_1,
        projectId: PROJECT_ID,
        title: "Ch 1",
        order: 2,
      }),
    );
    useSharedProjectStore.getState().upsertEntity(
      "chapters",
      makeChapter({
        id: CHAPTER_ID_2,
        projectId: PROJECT_ID,
        title: "Ch 2",
        order: 1,
      }),
    );

    const { result } = renderHook(() => useChaptersByProject(PROJECT_ID), {
      wrapper: SharedWrapper,
    });
    const arr = result.current as { id: ChapterId }[];
    expect(arr.map((c) => c.id)).toEqual([CHAPTER_ID_2, CHAPTER_ID_1]);
  });

  it("useCharactersByProject sorts by name in shared mode", () => {
    useSharedProjectStore.getState().upsertEntity(
      "characters",
      makeCharacter({
        id: CHARACTER_ID_1,
        projectId: PROJECT_ID,
        name: "Bob",
      }),
    );
    const id2 = "00000000-0000-4000-8000-000000000012" as CharacterId;
    useSharedProjectStore
      .getState()
      .upsertEntity(
        "characters",
        makeCharacter({ id: id2, projectId: PROJECT_ID, name: "Alice" }),
      );

    const { result } = renderHook(() => useCharactersByProject(PROJECT_ID), {
      wrapper: SharedWrapper,
    });
    const arr = result.current as { name: string }[];
    expect(arr.map((c) => c.name)).toEqual(["Alice", "Bob"]);
  });
});
