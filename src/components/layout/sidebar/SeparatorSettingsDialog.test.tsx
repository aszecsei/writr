// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createSeparator } from "@/db/operations";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { useUiStore } from "@/store/uiStore";
import { resetIdCounter } from "@/test/helpers";
import { SeparatorSettingsDialog } from "./SeparatorSettingsDialog";

const projectId = "00000000-0000-4000-8000-0000000000aa" as ProjectId;

describe("SeparatorSettingsDialog", () => {
  beforeEach(async () => {
    resetIdCounter();
    await db.chapters.clear();
    useUiStore.getState().closeModal();
  });

  afterEach(() => {
    useUiStore.getState().closeModal();
  });

  it("renders nothing when the modal is closed", () => {
    const { container } = render(<SeparatorSettingsDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("loads the separator's label and compile settings", async () => {
    const sep = await createSeparator({
      projectId,
      title: "Part Two",
    });
    await db.chapters.update(sep.id, {
      includeInCompile: true,
      pageBreakBefore: true,
    });
    useUiStore
      .getState()
      .openModal({ id: "separator-settings", chapterId: sep.id });

    render(<SeparatorSettingsDialog />);

    await waitFor(() =>
      expect(screen.getByDisplayValue("Part Two")).toBeTruthy(),
    );
    const [includeBox, pageBreakBox] = screen.getAllByRole("checkbox");
    expect((includeBox as HTMLInputElement).checked).toBe(true);
    expect((pageBreakBox as HTMLInputElement).checked).toBe(true);
  });

  it("saves edited label and toggles back to the database", async () => {
    const sep = await createSeparator({ projectId, title: "Part" });
    useUiStore
      .getState()
      .openModal({ id: "separator-settings", chapterId: sep.id });

    render(<SeparatorSettingsDialog />);

    const input = await screen.findByDisplayValue("Part");
    fireEvent.change(input, { target: { value: "Act One" } });
    // includeInCompile defaults true → turn it off.
    const [includeBox] = screen.getAllByRole("checkbox");
    fireEvent.click(includeBox);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(async () => {
      const updated = await db.chapters.get(sep.id as ChapterId);
      expect(updated?.title).toBe("Act One");
      expect(updated?.includeInCompile).toBe(false);
    });
    expect(useUiStore.getState().modal.id).toBeNull();
  });
});
