// @vitest-environment jsdom
import { render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShareUrls } from "@/lib/collab/lifecycle";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import { ShareDialog, ShareDialogContent } from "./ShareDialog";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_COLLAB_URL;

const SAMPLE_URLS: ShareUrls = {
  edit: "https://writr.app/shared/r1?t=edit-tok#k=k",
  review: "https://writr.app/shared/r1?t=review-tok#k=k",
  view: "https://writr.app/shared/r1?t=view-tok#k=k",
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_COLLAB_URL = "ws://localhost:4444";
  useUiStore.getState().closeModal();
  useCollabStore.getState().reset();
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_COLLAB_URL;
  else process.env.NEXT_PUBLIC_COLLAB_URL = ORIGINAL_ENV;
  useUiStore.getState().closeModal();
  useCollabStore.getState().reset();
});

describe("ShareDialogContent (snapshots)", () => {
  it("renders the idle state with a Start sharing button", () => {
    const { container } = render(
      <ShareDialogContent
        status="idle"
        peerCount={0}
        shareUrls={null}
        errorMessage={null}
        onStart={async () => {}}
        onEnd={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the connecting state with a spinner", () => {
    const { container } = render(
      <ShareDialogContent
        status="connecting"
        peerCount={0}
        shareUrls={null}
        errorMessage={null}
        onStart={async () => {}}
        onEnd={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the connected state with three labeled URLs and an end button", () => {
    const { container } = render(
      <ShareDialogContent
        status="connected"
        peerCount={3}
        shareUrls={SAMPLE_URLS}
        errorMessage={null}
        onStart={async () => {}}
        onEnd={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the host_disconnected (grace) variant of connected", () => {
    const { container } = render(
      <ShareDialogContent
        status="host_disconnected"
        peerCount={2}
        shareUrls={SAMPLE_URLS}
        errorMessage={null}
        onStart={async () => {}}
        onEnd={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the ended state with a prior error and a Try again button", () => {
    const { container } = render(
      <ShareDialogContent
        status="ended"
        peerCount={0}
        shareUrls={null}
        errorMessage="Rate limited by collab relay"
        onStart={async () => {}}
        onEnd={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("ShareDialog (gating)", () => {
  it("renders nothing when no modal is open", () => {
    const { container } = render(<ShareDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when a different modal is open", () => {
    useUiStore.getState().openModal({ id: "app-settings" });
    const { container } = render(<ShareDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when collab is disabled, even if the modal id matches", () => {
    delete process.env.NEXT_PUBLIC_COLLAB_URL;
    useUiStore.getState().openModal({ id: "share-collab-session" });
    const { container } = render(<ShareDialog />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the dialog when collab is enabled and the modal id matches", () => {
    useUiStore.getState().openModal({ id: "share-collab-session" });
    const { container } = render(<ShareDialog />);
    expect(within(container).getByText("Share session")).toBeInTheDocument();
  });
});
