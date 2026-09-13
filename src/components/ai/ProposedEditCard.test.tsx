// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { ChapterId } from "@/db/schemas";
import { useEditorStore } from "@/store/editorStore";
import {
  ProposedEditCard,
  type ProposedEditChatPayload,
} from "./ProposedEditCard";

const chapterId = "b2222222-2222-4222-a222-222222222222" as ChapterId;

const payload: ProposedEditChatPayload = {
  chapterId,
  chapterTitle: "Chapter 1",
  kind: "replace",
  anchorText: "walked quickly",
  newContent: "strode",
  originalText: "walked quickly",
  anchorFound: true,
};

beforeEach(() => {
  useEditorStore.setState({
    activeDocumentId: chapterId,
    activeDocumentType: "chapter",
    pendingStagedEdit: null,
    stagedEditResults: {},
  });
});

describe("ProposedEditCard", () => {
  it("disables Apply while another staged edit is pending", () => {
    useEditorStore.setState({
      pendingStagedEdit: {
        editId: "other",
        chapterId,
        kind: "append",
        newContent: "…",
      },
    });

    render(<ProposedEditCard payload={payload} />);

    expect(screen.getByRole("button", { name: /apply/i })).toBeDisabled();
  });

  it("posts the staged edit when Apply is clicked and nothing else is pending", () => {
    render(<ProposedEditCard payload={payload} />);
    const apply = screen.getByRole("button", { name: /apply/i });
    expect(apply).toBeEnabled();

    fireEvent.click(apply);

    const pending = useEditorStore.getState().pendingStagedEdit;
    expect(pending?.chapterId).toBe(chapterId);
    expect(pending?.anchorText).toBe("walked quickly");
    expect(pending?.newContent).toBe("strode");
    expect(screen.getByRole("button", { name: /applying/i })).toBeDisabled();
  });
});
