// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollabSession } from "@/lib/collab/session";
import { withCollabEnv } from "@/lib/collab/test-support";
import { useCollabStore } from "@/store/collabStore";
import { CollabBanner, CollabBannerContent } from "./CollabBanner";

const fakeSession = {} as CollabSession;
const FIXED_NOW = 1_700_000_000_000;

withCollabEnv(undefined, () => {
  beforeEach(() => {
    useCollabStore.getState().reset();
  });

  afterEach(() => {
    useCollabStore.getState().reset();
  });

  describe("CollabBannerContent", () => {
    it("renders the host-connected state with peer count and End session", () => {
      const { container } = render(
        <CollabBannerContent
          viewerRole="host"
          status="connected"
          peerCount={3}
          hostPresent={true}
          graceDeadline={null}
          onLeave={vi.fn()}
        />,
      );
      expect(
        within(container).getByText("Sharing as host"),
      ).toBeInTheDocument();
      expect(within(container).getByText("3 peers")).toBeInTheDocument();
      expect(
        within(container).getByRole("button", { name: /end session/i }),
      ).toBeInTheDocument();
    });

    it("renders the edit-guest connected state with host indicator and Leave", () => {
      const { container } = render(
        <CollabBannerContent
          viewerRole="edit"
          status="connected"
          peerCount={2}
          hostPresent={true}
          graceDeadline={null}
          onLeave={vi.fn()}
        />,
      );
      expect(within(container).getByText("Joined as edit")).toBeInTheDocument();
      expect(within(container).getByText("Host present")).toBeInTheDocument();
      expect(
        within(container).getByRole("button", { name: /leave/i }),
      ).toBeInTheDocument();
    });

    it("renders the view-guest connected state with host-away indicator", () => {
      const { container } = render(
        <CollabBannerContent
          viewerRole="view"
          status="connected"
          peerCount={4}
          hostPresent={false}
          graceDeadline={null}
          onLeave={vi.fn()}
        />,
      );
      expect(within(container).getByText("Joined as view")).toBeInTheDocument();
      expect(within(container).getByText("Host away")).toBeInTheDocument();
    });

    it("renders the host_disconnected grace state with a deterministic countdown", () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);
      try {
        const { container } = render(
          <CollabBannerContent
            viewerRole="edit"
            status="host_disconnected"
            peerCount={2}
            hostPresent={false}
            graceDeadline={FIXED_NOW + 30_000}
            onLeave={vi.fn()}
          />,
        );
        expect(
          within(container).getByText("Host disconnected — 30s left"),
        ).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("renders the host_disconnected state with an exhausted timer", () => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);
      try {
        const { container } = render(
          <CollabBannerContent
            viewerRole="edit"
            status="host_disconnected"
            peerCount={2}
            hostPresent={false}
            graceDeadline={FIXED_NOW - 1}
            onLeave={vi.fn()}
          />,
        );
        expect(
          within(container).getByText("Host disconnected — 0s left"),
        ).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("calls onLeave when the End session / Leave button is clicked", () => {
      const onLeave = vi.fn();
      const { container } = render(
        <CollabBannerContent
          viewerRole="host"
          status="connected"
          peerCount={1}
          hostPresent={true}
          graceDeadline={null}
          onLeave={onLeave}
        />,
      );
      fireEvent.click(
        within(container).getByRole("button", { name: /End session/i }),
      );
      expect(onLeave).toHaveBeenCalledTimes(1);
    });

    it("renders a 'N waiting' pill when the host has pending join requests", () => {
      const { container } = render(
        <CollabBannerContent
          viewerRole="host"
          status="connected"
          peerCount={1}
          hostPresent={true}
          graceDeadline={null}
          pendingCount={2}
          onManageParticipants={vi.fn()}
          onLeave={vi.fn()}
        />,
      );
      expect(
        within(container).getByRole("button", { name: "2 waiting" }),
      ).toBeInTheDocument();
      expect(
        within(container).getByRole("button", { name: "Manage" }),
      ).toBeInTheDocument();
    });

    it("renders a Manage button for hosts with no pending requests", () => {
      const { container } = render(
        <CollabBannerContent
          viewerRole="host"
          status="connected"
          peerCount={1}
          hostPresent={true}
          graceDeadline={null}
          pendingCount={0}
          onManageParticipants={vi.fn()}
          onLeave={vi.fn()}
        />,
      );
      expect(
        within(container).getByRole("button", { name: "Manage" }),
      ).toBeInTheDocument();
      expect(
        within(container).queryByRole("button", { name: /waiting/ }),
      ).toBeNull();
    });
  });

  describe("CollabBanner (gating regression net)", () => {
    it("renders nothing when NEXT_PUBLIC_COLLAB_URL is unset, even with a session", () => {
      delete process.env.NEXT_PUBLIC_COLLAB_URL;
      useCollabStore.getState().setSession(fakeSession, {
        role: "host",
        peerId: "p",
        hostPresent: true,
      });
      const { container } = render(<CollabBanner />);
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when collab is enabled but no session is active", () => {
      process.env.NEXT_PUBLIC_COLLAB_URL = "ws://localhost:4444";
      const { container } = render(<CollabBanner />);
      expect(container.firstChild).toBeNull();
    });

    it("renders the banner when collab is enabled and a session is active", () => {
      process.env.NEXT_PUBLIC_COLLAB_URL = "ws://localhost:4444";
      useCollabStore.getState().setSession(fakeSession, {
        role: "host",
        peerId: "p",
        hostPresent: true,
      });
      useCollabStore.getState().setPeerCount(2);
      const { container } = render(<CollabBanner />);
      expect(within(container).getByRole("status")).toBeInTheDocument();
      expect(
        within(container).getByText(/Sharing as host/i),
      ).toBeInTheDocument();
      expect(within(container).getByText("2 peers")).toBeInTheDocument();
    });
  });
});
