// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { updateChapterContent } from "@/db/operations/chapters";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { useEditorStore } from "@/store/editorStore";
import { makeChapter, makeProject } from "@/test/helpers";
import { RepeatedPassagesSection } from "./RepeatedPassagesSection";

const PASSAGE =
  "The salt-stained windows of the lighthouse rattled whenever the northern gale came howling across the bay.";

// Distinct per test: the hook remembers each project's last run.
let projectSeq = 0;
function nextProjectId(): ProjectId {
  projectSeq++;
  return `00000000-0000-4000-8000-${String(projectSeq).padStart(12, "0")}` as ProjectId;
}

function chapterId(n: number): ChapterId {
  return `11111111-0000-4000-8000-${String(n).padStart(12, "0")}` as ChapterId;
}

async function seed(projectId: ProjectId) {
  await db.projects.add(makeProject({ id: projectId, title: "Draft" }));
  await db.chapters.bulkAdd([
    makeChapter({
      projectId,
      id: chapterId(1),
      title: "Arrival",
      order: 0,
      content: `She climbed the stairs. ${PASSAGE}`,
    }),
    makeChapter({
      projectId,
      id: chapterId(2),
      title: "Second story",
      kind: "separator",
      order: 1,
    }),
    makeChapter({
      projectId,
      id: chapterId(3),
      title: "Return",
      order: 2,
      content: `Years later. ${PASSAGE}`,
    }),
  ]);
}

describe("RepeatedPassagesSection", () => {
  beforeEach(async () => {
    await db.chapters.clear();
    await db.projects.clear();
    useEditorStore.setState({ pendingPassageReveal: null });
  });

  it("lists a passage copied between chapters after running", async () => {
    const projectId = nextProjectId();
    await seed(projectId);
    render(
      <RepeatedPassagesSection projectId={projectId} projectMode="prose" />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Run" }));

    expect(await screen.findByText("Arrival")).toBeTruthy();
    expect(screen.getByText("Return")).toBeTruthy();
    expect(screen.getByText("2×")).toBeTruthy();
  });

  it("confines the comparison to the selected story", async () => {
    const projectId = nextProjectId();
    await seed(projectId);
    render(
      <RepeatedPassagesSection projectId={projectId} projectMode="prose" />,
    );

    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: `group:${chapterId(2)}` } });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("No repeated passages found.")).toBeTruthy();
  });

  it("requests a reveal of the clicked passage in its chapter", async () => {
    const projectId = nextProjectId();
    await seed(projectId);
    render(
      <RepeatedPassagesSection projectId={projectId} projectMode="prose" />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Run" }));
    const link = await screen.findByText("Return");
    // jsdom can't navigate; stop the anchor's default after React handles it.
    document.addEventListener("click", (e) => e.preventDefault(), {
      once: true,
    });

    fireEvent.click(link);

    expect(useEditorStore.getState().pendingPassageReveal?.chapterId).toBe(
      chapterId(3),
    );
  });

  it("flags results as out of date after a chapter changes", async () => {
    const projectId = nextProjectId();
    await seed(projectId);
    render(
      <RepeatedPassagesSection projectId={projectId} projectMode="prose" />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Run" }));
    await screen.findByText("Return");

    await updateChapterContent(chapterId(3), "Rewritten entirely.", 2);

    await waitFor(() =>
      expect(
        screen.getByText(/manuscript changed since this ran/),
      ).toBeTruthy(),
    );
  });

  it("points to the Project tab when no project is in scope", () => {
    render(<RepeatedPassagesSection projectId={null} projectMode="prose" />);
    expect(screen.getByText(/Open the Project tab/)).toBeTruthy();
  });
});
