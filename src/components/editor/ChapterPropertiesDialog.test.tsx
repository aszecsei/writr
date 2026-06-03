// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import { AppSettingsSchema, type ChapterId } from "@/db/schemas";
import { APP_SETTINGS_ID } from "@/lib/constants";
import { useUiStore } from "@/store/uiStore";
import { makeChapter, makeProject, resetIdCounter } from "@/test/helpers";
import { ChapterPropertiesDialog } from "./ChapterPropertiesDialog";

vi.mock("@/lib/ai/client", () => ({
  summarizeChapter: vi.fn(async () => "GENERATED"),
}));

import { summarizeChapter } from "@/lib/ai/client";

const project = makeProject({ title: "P" });

async function seedSettings(enableAiFeatures: boolean): Promise<void> {
  const base = AppSettingsSchema.parse({
    id: APP_SETTINGS_ID,
    enableAiFeatures,
    aiProvider: "openrouter",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  await db.appSettings.put({
    ...base,
    providerApiKeys: { ...base.providerApiKeys, openrouter: "sk-test" },
  });
}

async function seedChapter(synopsis: string): Promise<ChapterId> {
  const chapter = makeChapter({
    projectId: project.id,
    title: "Chapter One",
    content: "Once upon a time there was a body of text.",
    synopsis,
  });
  await db.chapters.add(chapter);
  return chapter.id;
}

beforeEach(async () => {
  useUiStore.getState().closeModal();
  await db.chapters.clear();
  await db.appSettings.clear();
  resetIdCounter();
  vi.mocked(summarizeChapter).mockClear();
  vi.mocked(summarizeChapter).mockResolvedValue("GENERATED");
});

afterEach(() => {
  useUiStore.getState().closeModal();
});

describe("ChapterPropertiesDialog", () => {
  it("renders nothing when the chapter-properties modal is not open", () => {
    const { container } = render(<ChapterPropertiesDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("edits and saves the synopsis", async () => {
    await seedSettings(true);
    const chapterId = await seedChapter("INIT");
    useUiStore.getState().openModal({ id: "chapter-properties", chapterId });

    render(<ChapterPropertiesDialog />);
    const textarea = (await screen.findByRole(
      "textbox",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe("INIT"));

    fireEvent.change(textarea, { target: { value: "My summary" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(useUiStore.getState().modal.id).toBeNull());
    expect((await db.chapters.get(chapterId))?.synopsis).toBe("My summary");
  });

  it("generates a staged summary and overwrites on Overwrite", async () => {
    await seedSettings(true);
    const chapterId = await seedChapter("OLD");
    useUiStore.getState().openModal({ id: "chapter-properties", chapterId });

    render(<ChapterPropertiesDialog />);
    const textarea = (await screen.findByRole(
      "textbox",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe("OLD"));

    fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));
    await screen.findByText("GENERATED");

    fireEvent.click(screen.getByRole("button", { name: "Overwrite" }));
    expect(textarea.value).toBe("GENERATED");
    expect(screen.queryByRole("button", { name: "Overwrite" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(useUiStore.getState().modal.id).toBeNull());
    expect((await db.chapters.get(chapterId))?.synopsis).toBe("GENERATED");
  });

  it("prepends the staged summary before existing text on Prepend", async () => {
    await seedSettings(true);
    const chapterId = await seedChapter("OLD");
    useUiStore.getState().openModal({ id: "chapter-properties", chapterId });

    render(<ChapterPropertiesDialog />);
    const textarea = (await screen.findByRole(
      "textbox",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe("OLD"));

    fireEvent.click(screen.getByRole("button", { name: /generate with ai/i }));
    await screen.findByText("GENERATED");

    fireEvent.click(screen.getByRole("button", { name: "Prepend" }));
    expect(textarea.value).toBe("GENERATED\n\nOLD");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(useUiStore.getState().modal.id).toBeNull());
    expect((await db.chapters.get(chapterId))?.synopsis).toBe(
      "GENERATED\n\nOLD",
    );
  });

  it("hides the AI generate button when AI features are disabled", async () => {
    await seedSettings(false);
    const chapterId = await seedChapter("INIT");
    useUiStore.getState().openModal({ id: "chapter-properties", chapterId });

    render(<ChapterPropertiesDialog />);
    // The synopsis textarea is always present...
    const textarea = (await screen.findByRole(
      "textbox",
    )) as HTMLTextAreaElement;
    await waitFor(() => expect(textarea.value).toBe("INIT"));
    // ...but the AI section is gated off.
    expect(
      screen.queryByRole("button", { name: /generate with ai/i }),
    ).toBeNull();
  });
});
