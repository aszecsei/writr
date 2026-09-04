// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/database";
import { createSavedPrompt } from "@/db/operations/savedPrompts";
import { useUiStore } from "@/store/uiStore";
import { SavedPromptsManager } from "./SavedPromptsManager";

beforeEach(async () => {
  useUiStore.getState().closeModal();
  await db.savedPrompts.clear();
});

afterEach(() => {
  useUiStore.getState().closeModal();
});

describe("SavedPromptsManager", () => {
  it("lists existing prompts with a Global badge for global prompts", async () => {
    await createSavedPrompt({ title: "Global helper", body: "x" });
    useUiStore.getState().openModal({ id: "saved-prompts" });

    render(<SavedPromptsManager />);

    const row = (await screen.findByText("Global helper")).closest("div");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Global")).toBeInTheDocument();
  });

  it("shows the empty state when there are no prompts", async () => {
    useUiStore.getState().openModal({ id: "saved-prompts" });
    render(<SavedPromptsManager />);
    expect(
      await screen.findByText(/No saved prompts yet/i),
    ).toBeInTheDocument();
  });
});
