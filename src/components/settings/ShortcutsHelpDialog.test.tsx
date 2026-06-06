// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { ShortcutsHelpDialog } from "./ShortcutsHelpDialog";

describe("ShortcutsHelpDialog", () => {
  beforeEach(() => {
    useUiStore.getState().closeModal();
    useProjectStore.setState({ activeProjectMode: "prose" });
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

  it("uses screenplay terminology for create commands", () => {
    useProjectStore.setState({ activeProjectMode: "screenplay" });
    useUiStore.getState().openModal({ id: "shortcuts-help" });
    render(<ShortcutsHelpDialog />);

    expect(screen.getByText("Add Sequence")).toBeInTheDocument();
  });
});
