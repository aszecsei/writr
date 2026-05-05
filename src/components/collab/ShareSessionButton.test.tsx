// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CollabSession } from "@/lib/collab/session";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import { ShareSessionButton } from "./ShareSessionButton";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_COLLAB_URL;
const fakeSession = {} as CollabSession;

beforeEach(() => {
  useUiStore.getState().closeModal();
  useCollabStore.getState().reset();
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_COLLAB_URL;
  else process.env.NEXT_PUBLIC_COLLAB_URL = ORIGINAL_ENV;
  useUiStore.getState().closeModal();
  useCollabStore.getState().reset();
});

describe("ShareSessionButton: gating regression net", () => {
  it("renders nothing when NEXT_PUBLIC_COLLAB_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_COLLAB_URL;
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
    expect(container.firstChild).toMatchSnapshot();
    const btn = within(container).getByRole("button", {
      name: "Share session",
    });
    expect(btn).toBeInTheDocument();
  });

  it("renders the Sharing indicator when a session is active", () => {
    useCollabStore.getState().setSession(fakeSession, {
      role: "host",
      peerId: "p",
      hostPresent: true,
    });
    const { container } = render(<ShareSessionButton />);
    expect(container.firstChild).toMatchSnapshot();
    const btn = within(container).getByRole("button", {
      name: "Sharing session",
    });
    expect(btn).toBeInTheDocument();
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
