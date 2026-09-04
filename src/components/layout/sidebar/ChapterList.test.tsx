// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { makeChapter, makeProject, resetIdCounter } from "@/test/helpers";
import { ChapterList } from "./ChapterList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const projectId = "00000000-0000-4000-8000-0000000000aa" as ProjectId;
const chId = "00000000-0000-4000-8000-000000000001" as ChapterId;
const sceneId = "00000000-0000-4000-8000-000000000002" as ChapterId;
const sepId = "00000000-0000-4000-8000-000000000003" as ChapterId;
const scratchId = "00000000-0000-4000-8000-000000000004" as ChapterId;

describe("ChapterList", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    await db.projects.clear();
    await db.projects.add(makeProject({ id: projectId, title: "Draft" }));
    useProjectStore.setState({ activeProjectId: projectId });
    useUiStore.getState().closeModal();
    useUiStore.setState({ collapsedChapters: {} });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the manuscript and scratchpad sections with nesting", async () => {
    await db.chapters.bulkAdd([
      makeChapter({ projectId, id: chId, title: "Chapter 1", order: 0 }),
      makeChapter({
        projectId,
        id: sceneId,
        title: "Scene A",
        parentChapterId: chId,
        order: 0,
      }),
      makeChapter({
        projectId,
        id: sepId,
        title: "Part One",
        kind: "separator",
        order: 1,
      }),
      makeChapter({
        projectId,
        id: scratchId,
        title: "Loose Notes",
        section: "scratchpad",
        order: 0,
      }),
    ]);

    render(
      <ChapterList projectId={projectId} pathname={`/projects/${projectId}`} />,
    );

    // Manuscript: parent chapter, its nested scene, and the separator.
    await waitFor(() => expect(screen.getByText("Chapter 1")).toBeTruthy());
    expect(screen.getByText("Scene A")).toBeTruthy();
    expect(screen.getByText("Part One")).toBeTruthy();
    // Scratchpad section and its document.
    expect(screen.getByText("Scratchpad")).toBeTruthy();
    expect(screen.getByText("Loose Notes")).toBeTruthy();
  });

  it("hides a folder's children when it is collapsed", async () => {
    await db.chapters.bulkAdd([
      makeChapter({ projectId, id: chId, title: "Chapter 1", order: 0 }),
      makeChapter({
        projectId,
        id: sceneId,
        title: "Scene A",
        parentChapterId: chId,
        order: 0,
      }),
    ]);
    useUiStore.setState({ collapsedChapters: { [chId]: true } });

    render(
      <ChapterList projectId={projectId} pathname={`/projects/${projectId}`} />,
    );

    await waitFor(() => expect(screen.getByText("Chapter 1")).toBeTruthy());
    expect(screen.queryByText("Scene A")).toBeNull();
  });

  it("hides the 'Add Nested' action when nesting is disabled (default)", async () => {
    await db.chapters.bulkAdd([
      makeChapter({ projectId, id: chId, title: "Chapter 1", order: 0 }),
    ]);
    render(
      <ChapterList projectId={projectId} pathname={`/projects/${projectId}`} />,
    );
    await waitFor(() => expect(screen.getByText("Chapter 1")).toBeTruthy());

    fireEvent.contextMenu(screen.getByText("Chapter 1"));
    expect(screen.getByText("Rename")).toBeTruthy();
    expect(screen.queryByText("Add Nested Chapter")).toBeNull();
  });

  it("shows the 'Add Nested' action when nesting is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_NESTING", "true");
    await db.chapters.bulkAdd([
      makeChapter({ projectId, id: chId, title: "Chapter 1", order: 0 }),
    ]);
    render(
      <ChapterList projectId={projectId} pathname={`/projects/${projectId}`} />,
    );
    await waitFor(() => expect(screen.getByText("Chapter 1")).toBeTruthy());

    fireEvent.contextMenu(screen.getByText("Chapter 1"));
    expect(screen.getByText("Add Nested Chapter")).toBeTruthy();
  });
});
