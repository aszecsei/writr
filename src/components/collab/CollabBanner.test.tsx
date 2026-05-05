// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollabSession } from "@/lib/collab/session";
import { useCollabStore } from "@/store/collabStore";
import { CollabBanner, CollabBannerContent } from "./CollabBanner";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_COLLAB_URL;
const fakeSession = {} as CollabSession;
const FIXED_NOW = 1_700_000_000_000;

beforeEach(() => {
  useCollabStore.getState().reset();
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_COLLAB_URL;
  else process.env.NEXT_PUBLIC_COLLAB_URL = ORIGINAL_ENV;
  useCollabStore.getState().reset();
});

describe("CollabBannerContent (snapshots)", () => {
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
    expect(container.firstChild).toMatchSnapshot();
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
    expect(container.firstChild).toMatchSnapshot();
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
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the host_disconnected grace state with a deterministic countdown", () => {
    const { container } = render(
      <CollabBannerContent
        viewerRole="edit"
        status="host_disconnected"
        peerCount={2}
        hostPresent={false}
        graceDeadline={FIXED_NOW + 30_000}
        onLeave={vi.fn()}
        nowOverride={FIXED_NOW}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the host_disconnected state with an exhausted timer", () => {
    const { container } = render(
      <CollabBannerContent
        viewerRole="edit"
        status="host_disconnected"
        peerCount={2}
        hostPresent={false}
        graceDeadline={FIXED_NOW - 1}
        onLeave={vi.fn()}
        nowOverride={FIXED_NOW}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
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
    expect(within(container).getByText(/Sharing as host/i)).toBeInTheDocument();
    expect(within(container).getByText("2 peers")).toBeInTheDocument();
  });
});
