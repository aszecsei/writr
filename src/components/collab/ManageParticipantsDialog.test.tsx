// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollabStore } from "@/store/collabStore";
import { useUiStore } from "@/store/uiStore";
import { ManageParticipantsDialog } from "./ManageParticipantsDialog";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_COLLAB_URL;

vi.mock("@/hooks/collab/useCollabManager", async () => {
  const revokes: string[] = [];
  return {
    useCollabManager: () => ({
      enabled: true,
      startAsHost: vi.fn(),
      joinAsGuest: vi.fn(),
      end: vi.fn(),
      approveJoinRequest: vi.fn(),
      denyJoinRequest: vi.fn(),
      revokeGuest: (pub: string) => {
        revokes.push(pub);
      },
    }),
    __testRevokes: revokes,
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

describe("ManageParticipantsDialog (gating)", () => {
  it("renders nothing when manage-participants modal is not open", () => {
    const { container } = render(<ManageParticipantsDialog />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ManageParticipantsDialog (snapshots)", () => {
  it("renders empty-state when no guests are approved", () => {
    useUiStore.getState().openModal({ id: "collab-manage-participants" });
    const { baseElement } = render(<ManageParticipantsDialog />);
    expect(baseElement.querySelector(".modal-panel")).toMatchSnapshot();
  });

  it("renders a list of approved guests sorted by approvedAt desc", () => {
    // Set approvedAt explicitly for snapshot determinism rather than relying
    // on Date.now() in the action.
    useCollabStore.setState({
      approvedGuests: {
        "pub-1": {
          displayName: "Alice",
          color: "#cc6699",
          approvedAt: 100,
        },
        "pub-2": { displayName: "Bob", color: "#3366cc", approvedAt: 200 },
      },
    });
    useUiStore.getState().openModal({ id: "collab-manage-participants" });
    const { baseElement } = render(<ManageParticipantsDialog />);
    expect(baseElement.querySelector(".modal-panel")).toMatchSnapshot();
  });

  it("shows a 'waiting to join' shortcut when there's a pending request", () => {
    useCollabStore.getState().addPendingJoinRequest({
      requestId: "req-1",
      guestPub: "pub-pending",
      displayName: "Eve",
      color: "#ff0000",
      receivedAt: 0,
    });
    useUiStore.getState().openModal({ id: "collab-manage-participants" });
    const { baseElement } = render(<ManageParticipantsDialog />);
    expect(baseElement.querySelector(".modal-panel")).toMatchSnapshot();
  });
});

describe("ManageParticipantsDialog (interactions)", () => {
  it("Revoke calls revokeGuest with the guest's pubkey", async () => {
    const mod = (await import(
      "@/hooks/collab/useCollabManager"
    )) as unknown as {
      __testRevokes: string[];
    };
    mod.__testRevokes.length = 0;

    useCollabStore.getState().approveGuestPub("pub-1", {
      displayName: "Alice",
      color: "#cc6699",
    });
    useUiStore.getState().openModal({ id: "collab-manage-participants" });
    const { baseElement } = render(<ManageParticipantsDialog />);

    fireEvent.click(
      within(baseElement).getByRole("button", { name: /revoke/i }),
    );
    expect(mod.__testRevokes).toEqual(["pub-1"]);
  });
});
