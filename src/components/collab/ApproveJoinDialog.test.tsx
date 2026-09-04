// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withCollabEnv } from "@/lib/collab/test-support";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import { ApproveJoinDialog } from "./ApproveJoinDialog";

const { approveJoinRequest, denyJoinRequest } = vi.hoisted(() => ({
  approveJoinRequest: vi.fn().mockResolvedValue(undefined),
  denyJoinRequest: vi.fn(),
}));

vi.mock("@/hooks/collab/useCollabManager", () => ({
  useCollabManager: () => ({
    enabled: true,
    startAsHost: vi.fn(),
    joinAsGuest: vi.fn(),
    end: vi.fn(),
    approveJoinRequest,
    denyJoinRequest,
    revokeGuest: vi.fn(),
  }),
}));

withCollabEnv("ws://localhost:4444", () => {
  beforeEach(() => {
    useUiStore.getState().closeModal();
    useCollabStore.getState().reset();
    approveJoinRequest.mockClear();
    denyJoinRequest.mockClear();
  });

  afterEach(() => {
    useUiStore.getState().closeModal();
    useCollabStore.getState().reset();
  });

  describe("ApproveJoinDialog (gating)", () => {
    it("renders nothing when no approve-join modal is open", () => {
      const { container } = render(<ApproveJoinDialog />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("ApproveJoinDialog", () => {
    it("renders the approval prompt for a single pending guest", () => {
      useCollabStore.getState().addPendingJoinRequest({
        requestId: "req-1",
        guestPub: "pub-1",
        displayName: "Alice",
        color: "#cc6699",
        receivedAt: 0,
        from: "",
      });
      useUiStore.getState().openModal({
        id: "collab-approve-join",
        requestId: "req-1",
        displayName: "Alice",
        color: "#cc6699",
      });
      const { baseElement } = render(<ApproveJoinDialog />);
      expect(
        within(baseElement).getByText("Someone wants to join"),
      ).toBeInTheDocument();
      expect(within(baseElement).getByText("Alice")).toBeInTheDocument();
      expect(within(baseElement).queryByText(/more waiting/)).toBeNull();
    });

    it("renders a +N more waiting caption when the queue has more pending requests", () => {
      useCollabStore.getState().addPendingJoinRequest({
        requestId: "req-1",
        guestPub: "pub-1",
        displayName: "Alice",
        color: "#cc6699",
        receivedAt: 0,
        from: "",
      });
      useCollabStore.getState().addPendingJoinRequest({
        requestId: "req-2",
        guestPub: "pub-2",
        displayName: "Bob",
        color: "#3366cc",
        receivedAt: 1,
        from: "",
      });
      useCollabStore.getState().addPendingJoinRequest({
        requestId: "req-3",
        guestPub: "pub-3",
        displayName: "Carol",
        color: "#33cc66",
        receivedAt: 2,
        from: "",
      });
      useUiStore.getState().openModal({
        id: "collab-approve-join",
        requestId: "req-1",
        displayName: "Alice",
        color: "#cc6699",
      });
      const { baseElement } = render(<ApproveJoinDialog />);
      expect(
        within(baseElement).getByText(/\+2 more waiting/),
      ).toBeInTheDocument();
    });
  });

  describe("ApproveJoinDialog (interactions)", () => {
    it("Approve button triggers approveJoinRequest", async () => {
      useCollabStore.getState().addPendingJoinRequest({
        requestId: "req-1",
        guestPub: "pub-1",
        displayName: "Alice",
        color: "#cc6699",
        receivedAt: 0,
        from: "",
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
      expect(approveJoinRequest).toHaveBeenCalledWith("req-1");
    });

    it("Decline button triggers denyJoinRequest", () => {
      useCollabStore.getState().addPendingJoinRequest({
        requestId: "req-1",
        guestPub: "pub-1",
        displayName: "Alice",
        color: "#cc6699",
        receivedAt: 0,
        from: "",
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
      expect(denyJoinRequest).toHaveBeenCalledWith("req-1");
    });
  });
});
