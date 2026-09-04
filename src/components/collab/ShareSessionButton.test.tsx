// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CollabSession } from "@/lib/collab/session";
import { withCollabEnv } from "@/lib/collab/test-support";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import { ShareSessionButton } from "./ShareSessionButton";

const fakeSession = {} as CollabSession;

withCollabEnv(undefined, () => {
  beforeEach(() => {
    useUiStore.getState().closeModal();
    useCollabStore.getState().reset();
  });

  afterEach(() => {
    useUiStore.getState().closeModal();
    useCollabStore.getState().reset();
  });

  describe("ShareSessionButton: gating regression net", () => {
    it("renders nothing when NEXT_PUBLIC_COLLAB_URL is unset", () => {
      const { container } = render(<ShareSessionButton />);
      // Locks in the non-collab baseline: no button, no aria-label,
      // no subscriber to collab state. A future change that drops the
      // gate or imports the button unconditionally will fail this.
      expect(container.firstChild).toMatchSnapshot();
      expect(container.querySelector("button")).toBeNull();
    });
  });

  describe("ShareSessionButton: enabled states", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_COLLAB_URL = "ws://localhost:4444";
    });

    it("renders the Share button when no session is active", () => {
      const { container } = render(<ShareSessionButton />);
      const btn = within(container).getByRole("button", {
        name: "Share session",
      });
      expect(btn).toHaveAttribute("title", "Share session");
      expect(btn).not.toHaveClass("bg-emerald-100");
    });

    it("renders the Sharing indicator when a session is active", () => {
      useCollabStore.getState().setSession(fakeSession, {
        role: "host",
        peerId: "p",
        hostPresent: true,
      });
      const { container } = render(<ShareSessionButton />);
      const btn = within(container).getByRole("button", {
        name: "Sharing session",
      });
      expect(btn).toHaveAttribute("title", "Sharing session");
      expect(btn).toHaveClass("bg-emerald-100");
    });

    it("opens the share-collab-session modal when clicked", () => {
      const { container } = render(<ShareSessionButton />);
      const btn = within(container).getByRole("button", {
        name: "Share session",
      });
      fireEvent.click(btn);
      expect(useUiStore.getState().modal).toEqual({
        id: "share-collab-session",
      });
    });
  });
});
