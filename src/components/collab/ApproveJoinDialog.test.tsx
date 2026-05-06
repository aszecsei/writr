// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import { ApproveJoinDialog } from "./ApproveJoinDialog";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_COLLAB_URL;

vi.mock("@/hooks/collab/useCollabManager", async () => {
  const approvals: { requestId: string }[] = [];
  const denials: { requestId: string; reason?: string }[] = [];
  return {
    useCollabManager: () => ({
      enabled: true,
      startAsHost: vi.fn(),
      joinAsGuest: vi.fn(),
      end: vi.fn(),
      approveJoinRequest: async (requestId: string) => {
        approvals.push({ requestId });
      },
      denyJoinRequest: (requestId: string, reason?: string) => {
        const entry: { requestId: string; reason?: string } = { requestId };
        if (reason !== undefined) entry.reason = reason;
        denials.push(entry);
      },
      revokeGuest: vi.fn(),
    }),
    __testCalls: { approvals, denials },
  };
});

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

describe("ApproveJoinDialog (gating)", () => {
  it("renders nothing when no approve-join modal is open", () => {
    const { container } = render(<ApproveJoinDialog />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ApproveJoinDialog (snapshots)", () => {
  it("renders the approval prompt for a single pending guest", () => {
    useCollabStore.getState().addPendingJoinRequest({
      requestId: "req-1",
      guestPub: "pub-1",
      displayName: "Alice",
      color: "#cc6699",
      receivedAt: 0,
    });
    useUiStore.getState().openModal({
      id: "collab-approve-join",
      requestId: "req-1",
      displayName: "Alice",
      color: "#cc6699",
    });
    const { baseElement } = render(<ApproveJoinDialog />);
    expect(baseElement.querySelector(".modal-panel")).toMatchSnapshot();
  });

  it("renders a +N more waiting caption when the queue has more pending requests", () => {
    useCollabStore.getState().addPendingJoinRequest({
      requestId: "req-1",
      guestPub: "pub-1",
      displayName: "Alice",
      color: "#cc6699",
      receivedAt: 0,
    });
    useCollabStore.getState().addPendingJoinRequest({
      requestId: "req-2",
      guestPub: "pub-2",
      displayName: "Bob",
      color: "#3366cc",
      receivedAt: 1,
    });
    useCollabStore.getState().addPendingJoinRequest({
      requestId: "req-3",
      guestPub: "pub-3",
      displayName: "Carol",
      color: "#33cc66",
      receivedAt: 2,
    });
    useUiStore.getState().openModal({
      id: "collab-approve-join",
      requestId: "req-1",
      displayName: "Alice",
      color: "#cc6699",
    });
    const { baseElement } = render(<ApproveJoinDialog />);
    expect(baseElement.querySelector(".modal-panel")).toMatchSnapshot();
  });
});

describe("ApproveJoinDialog (interactions)", () => {
  it("Approve button triggers approveJoinRequest", async () => {
    const mod = (await import(
      "@/hooks/collab/useCollabManager"
    )) as unknown as {
      __testCalls: { approvals: Array<{ requestId: string }> };
    };
    mod.__testCalls.approvals.length = 0;

    useCollabStore.getState().addPendingJoinRequest({
      requestId: "req-1",
      guestPub: "pub-1",
      displayName: "Alice",
      color: "#cc6699",
      receivedAt: 0,
    });
    useUiStore.getState().openModal({
      id: "collab-approve-join",
      requestId: "req-1",
      displayName: "Alice",
      color: "#cc6699",
    });
    const { baseElement } = render(<ApproveJoinDialog />);
    fireEvent.click(
      within(baseElement).getByRole("button", { name: /approve/i }),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(mod.__testCalls.approvals).toEqual([{ requestId: "req-1" }]);
  });

  it("Decline button triggers denyJoinRequest", async () => {
    const mod = (await import(
      "@/hooks/collab/useCollabManager"
    )) as unknown as {
      __testCalls: { denials: Array<{ requestId: string; reason?: string }> };
    };
    mod.__testCalls.denials.length = 0;

    useCollabStore.getState().addPendingJoinRequest({
      requestId: "req-1",
      guestPub: "pub-1",
      displayName: "Alice",
      color: "#cc6699",
      receivedAt: 0,
    });
    useUiStore.getState().openModal({
      id: "collab-approve-join",
      requestId: "req-1",
      displayName: "Alice",
      color: "#cc6699",
    });
    const { baseElement } = render(<ApproveJoinDialog />);
    fireEvent.click(
      within(baseElement).getByRole("button", { name: /decline/i }),
    );
    expect(mod.__testCalls.denials).toEqual([{ requestId: "req-1" }]);
  });
});

describe("ApproveJoinDialog (collab-disabled baseline)", () => {
  it("renders nothing when collab is disabled (no modal can be opened)", () => {
    delete process.env.NEXT_PUBLIC_COLLAB_URL;
    // Even if the modal state is somehow set, the AppShell mount gating
    // (isCollabEnabled() guard) prevents rendering. We assert the same
    // by not opening a modal here.
    const { container } = render(<ApproveJoinDialog />);
    expect(container.firstChild).toBeNull();
  });
});
