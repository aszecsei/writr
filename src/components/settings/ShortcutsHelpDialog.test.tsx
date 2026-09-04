// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import type { ProjectId } from "@/db/schemas";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { makeProject } from "@/test/helpers";
import { ShortcutsHelpDialog } from "./ShortcutsHelpDialog";

const projectId = "00000000-0000-4000-8000-0000000000aa" as ProjectId;

describe("ShortcutsHelpDialog", () => {
  beforeEach(async () => {
    useUiStore.getState().closeModal();
    await db.projects.clear();
    await db.projects.add(
      makeProject({ id: projectId, title: "Draft", mode: "prose" }),
    );
    useProjectStore.setState({ activeProjectId: projectId });
  });

  afterEach(() => {
    useUiStore.getState().closeModal();
  });

  it("renders nothing when the modal is closed", () => {
    const { container } = render(<ShortcutsHelpDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("lists registered commands grouped by category", () => {
    useUiStore.getState().openModal({ id: "shortcuts-help" });
    render(<ShortcutsHelpDialog />);

    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Go to Characters")).toBeInTheDocument();
    // Chord bindings render as "G then C".
    expect(screen.getByText("G then C")).toBeInTheDocument();
  });

  it("uses screenplay terminology for create commands", async () => {
    await db.projects.put(
      makeProject({ id: projectId, title: "Draft", mode: "screenplay" }),
    );
    useUiStore.getState().openModal({ id: "shortcuts-help" });
    render(<ShortcutsHelpDialog />);

    await waitFor(() =>
      expect(screen.getByText("Add Sequence")).toBeInTheDocument(),
    );
  });
});
