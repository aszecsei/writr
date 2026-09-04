// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withCollabEnv } from "@/lib/collab/test-support";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import { ManageParticipantsDialog } from "./ManageParticipantsDialog";

const { revokeGuest } = vi.hoisted(() => ({ revokeGuest: vi.fn() }));

vi.mock("@/hooks/collab/useCollabManager", () => ({
  useCollabManager: () => ({
    enabled: true,
    startAsHost: vi.fn(),
    joinAsGuest: vi.fn(),
    end: vi.fn(),
    approveJoinRequest: vi.fn(),
    denyJoinRequest: vi.fn(),
    revokeGuest,
  }),
}));

withCollabEnv("ws://localhost:4444", () => {
  beforeEach(() => {
    useUiStore.getState().closeModal();
    useCollabStore.getState().reset();
    revokeGuest.mockClear();
  });

  afterEach(() => {
    useUiStore.getState().closeModal();
    useCollabStore.getState().reset();
  });

  describe("ManageParticipantsDialog (gating)", () => {
    it("renders nothing when manage-participants modal is not open", () => {
      const { container } = render(<ManageParticipantsDialog />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("ManageParticipantsDialog", () => {
    it("renders empty-state when no guests are approved", () => {
      useUiStore.getState().openModal({ id: "collab-manage-participants" });
      const { baseElement } = render(<ManageParticipantsDialog />);
      expect(
        within(baseElement).getByText("No approved guests yet."),
      ).toBeInTheDocument();
      expect(
        within(baseElement).queryByRole("button", { name: /revoke/i }),
      ).toBeNull();
    });

    it("renders a list of approved guests sorted by approvedAt desc", () => {
      // Set approvedAt explicitly for determinism rather than relying on
      // Date.now() in the action.
      useCollabStore.setState({
        approvedGuests: {
          "pub-1": {
            displayName: "Alice",
            color: "#cc6699",
            approvedAt: 100,
            peerId: null,
          },
          "pub-2": {
            displayName: "Bob",
            color: "#3366cc",
            approvedAt: 200,
            peerId: null,
          },
        },
      });
      useUiStore.getState().openModal({ id: "collab-manage-participants" });
      const { baseElement } = render(<ManageParticipantsDialog />);
      const names = within(baseElement)
        .getAllByRole("listitem")
        .map((li) => li.textContent);
      expect(names[0]).toContain("Bob");
      expect(names[1]).toContain("Alice");
    });

    it("shows a 'waiting to join' shortcut when there's a pending request", () => {
      useCollabStore.getState().addPendingJoinRequest({
        requestId: "req-1",
        guestPub: "pub-pending",
        displayName: "Eve",
        color: "#ff0000",
        receivedAt: 0,
        from: "",
      });
      useUiStore.getState().openModal({ id: "collab-manage-participants" });
      const { baseElement } = render(<ManageParticipantsDialog />);
      expect(within(baseElement).getByText("Eve")).toBeInTheDocument();
      expect(
        within(baseElement).getByText("waiting to join"),
      ).toBeInTheDocument();
    });
  });

  describe("ManageParticipantsDialog (interactions)", () => {
    it("Revoke calls revokeGuest with the guest's pubkey", () => {
      useCollabStore.getState().approveGuestPub("pub-1", {
        displayName: "Alice",
        color: "#cc6699",
        peerId: "peer-1",
      });
      useUiStore.getState().openModal({ id: "collab-manage-participants" });
      const { baseElement } = render(<ManageParticipantsDialog />);

      fireEvent.click(
        within(baseElement).getByRole("button", { name: /revoke/i }),
      );
      expect(revokeGuest).toHaveBeenCalledWith("pub-1");
    });
  });
});
