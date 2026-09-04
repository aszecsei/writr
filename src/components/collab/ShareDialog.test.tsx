// @vitest-environment jsdom
import { render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShareUrls } from "@/lib/collab/lifecycle";
import { withCollabEnv } from "@/lib/collab/test-support";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import { ShareDialog, ShareDialogContent } from "./ShareDialog";

const SAMPLE_URLS: ShareUrls = {
  mode: "chapter",
  edit: "https://writr.app/shared/r1?t=edit-tok#h=h",
  review: "https://writr.app/shared/r1?t=review-tok#h=h",
  view: "https://writr.app/shared/r1?t=view-tok#h=h",
};

const SAMPLE_PROJECT_URLS: ShareUrls = {
  mode: "project",
  edit: "https://writr.app/shared/r1?t=edit-tok#h=h&p=1",
  review: "https://writr.app/shared/r1?t=review-tok#h=h&p=1",
  view: "https://writr.app/shared/r1?t=view-tok#h=h&p=1",
};

withCollabEnv("ws://localhost:4444", () => {
  beforeEach(() => {
    useUiStore.getState().closeModal();
    useCollabStore.getState().reset();
  });

  afterEach(() => {
    useUiStore.getState().closeModal();
    useCollabStore.getState().reset();
  });

  describe("ShareDialogContent", () => {
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
      expect(
        within(container).getByRole("button", { name: /start sharing/i }),
      ).toBeInTheDocument();
      expect(
        within(container).queryByRole("button", { name: /try again/i }),
      ).toBeNull();
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
      expect(
        within(container).getByText(/connecting to the relay/i),
      ).toBeInTheDocument();
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
      expect(
        within(container).getByText("3 people connected."),
      ).toBeInTheDocument();
      expect(within(container).getByLabelText("Edit share URL")).toHaveValue(
        SAMPLE_URLS.edit,
      );
      expect(within(container).getByLabelText("Review share URL")).toHaveValue(
        SAMPLE_URLS.review,
      );
      expect(within(container).getByLabelText("View share URL")).toHaveValue(
        SAMPLE_URLS.view,
      );
      expect(
        within(container).getByRole("button", { name: /end session/i }),
      ).toBeInTheDocument();
      expect(within(container).queryByText(/reconnecting/i)).toBeNull();
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
      expect(
        within(container).getByText("2 people connected."),
      ).toBeInTheDocument();
      expect(within(container).getByText(/reconnecting/i)).toBeInTheDocument();
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
      expect(
        within(container).getByText("Rate limited by collab relay"),
      ).toBeInTheDocument();
      expect(
        within(container).getByRole("button", { name: /try again/i }),
      ).toBeInTheDocument();
    });

    it("renders the connected state with project-mode descriptions", () => {
      const { container } = render(
        <ShareDialogContent
          status="connected"
          peerCount={2}
          shareUrls={SAMPLE_PROJECT_URLS}
          errorMessage={null}
          onStart={async () => {}}
          onEnd={vi.fn()}
          onClose={vi.fn()}
        />,
      );
      expect(
        within(container).getAllByText(/read-only project browse/i),
      ).toHaveLength(3);
      expect(within(container).getByLabelText("Edit share URL")).toHaveValue(
        SAMPLE_PROJECT_URLS.edit,
      );
    });
  });

  describe("ShareDialogContent (project-mode toggle)", () => {
    it.each([
      [true, "ticked"],
      [false, "left unchecked"],
    ] as const)(
      "passes projectMode=%s to onStart when the checkbox is %s",
      async (projectMode, _label) => {
        const onStart = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
          <ShareDialogContent
            status="idle"
            peerCount={0}
            shareUrls={null}
            errorMessage={null}
            onStart={onStart}
            onEnd={vi.fn()}
            onClose={vi.fn()}
          />,
        );
        if (projectMode) {
          const checkbox = within(container).getByLabelText(
            "Share entire project",
          ) as HTMLInputElement;
          checkbox.click();
        }
        const startButton = within(container).getByRole("button", {
          name: /start sharing/i,
        });
        startButton.click();
        await new Promise((r) => setTimeout(r, 0));
        expect(onStart).toHaveBeenCalledWith({ projectMode });
      },
    );
  });

  describe("ShareDialog (gating)", () => {
    it.each([
      ["no modal is open", undefined],
      ["a different modal is open", { id: "app-settings" as const }],
    ])("renders nothing when %s", (_label, modal) => {
      if (modal) useUiStore.getState().openModal(modal);
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
});
