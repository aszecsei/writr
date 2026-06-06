// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectId } from "@/db/schemas";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";
import { useShortcuts } from "./useShortcuts";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const projectId = "00000000-0000-4000-8000-0000000000aa" as ProjectId;

function press(
  target: EventTarget,
  key: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {},
) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...mods,
    }),
  );
}

describe("useShortcuts", () => {
  beforeEach(() => {
    pushMock.mockClear();
    useProjectStore.setState({
      activeProjectId: projectId,
      activeProjectMode: "prose",
    });
    useUiStore.setState({
      modal: { id: null },
      searchFocusToken: 0,
      focusModeEnabled: false,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("navigates on a chord sequence", () => {
    renderHook(() => useShortcuts());
    press(document.body, "g");
    press(document.body, "o");
    expect(pushMock).toHaveBeenCalledWith(`/projects/${projectId}/outline`);
  });

  it("ignores chord sequences typed in an input", () => {
    renderHook(() => useShortcuts());
    const input = document.createElement("input");
    document.body.appendChild(input);
    press(input, "g");
    press(input, "o");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("fires Mod+K to focus search even from an input", () => {
    renderHook(() => useShortcuts());
    const input = document.createElement("input");
    document.body.appendChild(input);
    press(input, "k", { ctrlKey: true });
    expect(useUiStore.getState().searchFocusToken).toBe(1);
  });

  it("exits focus mode on Escape even while the editor is focused", () => {
    renderHook(() => useShortcuts());
    useUiStore.setState({ focusModeEnabled: true });
    const editor = document.createElement("div");
    editor.className = "ProseMirror";
    document.body.appendChild(editor);
    press(editor, "Escape");
    expect(useUiStore.getState().focusModeEnabled).toBe(false);
  });

  it("still suppresses plain-key commands inside an editable target", () => {
    renderHook(() => useShortcuts());
    const editor = document.createElement("div");
    editor.className = "ProseMirror";
    document.body.appendChild(editor);
    press(editor, "?");
    expect(useUiStore.getState().modal.id).toBe(null);
  });

  it("suppresses dispatch while a modal is open", () => {
    renderHook(() => useShortcuts());
    useUiStore.setState({ modal: { id: "app-settings" } });
    press(document.body, "g");
    press(document.body, "o");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
