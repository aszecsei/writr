// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SavedPrompt, SavedPromptId } from "@/db/schemas";
import { PromptInput } from "./PromptInput";

function makePrompt(over: Partial<SavedPrompt> = {}): SavedPrompt {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    projectId: null,
    title: "Tighten scene",
    body: "Rewrite the selection to be tighter.",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  } as SavedPrompt;
}

function baseProps() {
  return {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    loading: false,
    onSelectPrompt: vi.fn(),
    pendingImages: [],
    onAddImage: vi.fn(),
    onRemoveImage: vi.fn(),
    onOpenImagePicker: vi.fn(),
  };
}

describe("PromptInput saved-prompts picker", () => {
  it("opens the picker and lists saved prompt titles", () => {
    render(
      <PromptInput
        {...baseProps()}
        savedPrompts={[
          makePrompt({ title: "Tighten scene" }),
          makePrompt({
            id: "00000000-0000-4000-8000-000000000002" as SavedPromptId,
            title: "Summarize so far",
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByTitle("Saved prompts"));
    expect(screen.getByText("Tighten scene")).toBeInTheDocument();
    expect(screen.getByText("Summarize so far")).toBeInTheDocument();
  });

  it("calls onSelectPrompt with the prompt body when one is chosen", () => {
    const props = baseProps();
    render(
      <PromptInput
        {...props}
        savedPrompts={[makePrompt({ body: "Make it punchier." })]}
      />,
    );

    fireEvent.click(screen.getByTitle("Saved prompts"));
    fireEvent.click(screen.getByText("Tighten scene"));
    expect(props.onSelectPrompt).toHaveBeenCalledWith("Make it punchier.");
  });

  it("shows an empty state when there are no saved prompts", () => {
    render(<PromptInput {...baseProps()} savedPrompts={[]} />);
    fireEvent.click(screen.getByTitle("Saved prompts"));
    expect(screen.getByText("No saved prompts yet.")).toBeInTheDocument();
  });
});
