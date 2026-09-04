// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuestSessionShell } from "./GuestSessionShell";

describe("GuestSessionShell", () => {
  it("renders the disabled state when collab is not configured", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "disabled" }} />,
    );
    expect(
      within(container).getByText("Collaboration is not enabled"),
    ).toBeInTheDocument();
    expect(within(container).queryByRole("button")).toBeNull();
  });

  it("renders the missing-token error", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "missing-token" }} />,
    );
    expect(
      within(container).getByText("Share link is incomplete"),
    ).toBeInTheDocument();
  });

  it("renders the missing-host-key error", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "missing-host-key" }} />,
    );
    expect(
      within(container).getByText("This invitation link is invalid"),
    ).toBeInTheDocument();
  });

  it("renders the connecting state with a spinner", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "connecting" }} />,
    );
    expect(
      within(container).getByText("Joining the session…"),
    ).toBeInTheDocument();
  });

  it("renders the awaiting-approval state with a spinner", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "awaiting-approval" }} />,
    );
    expect(
      within(container).getByText(
        "Waiting for the host to approve your request…",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ["not on the list", "not on the list"],
    [null, "You weren't admitted to this collaborative session."],
  ])("renders the denied state with reason=%s", (reason, expectedMessage) => {
    const { container } = render(
      <GuestSessionShell
        state={{ kind: "denied", reason }}
        onLeave={vi.fn()}
      />,
    );
    expect(
      within(container).getByText("The host declined your request"),
    ).toBeInTheDocument();
    expect(within(container).getByText(expectedMessage)).toBeInTheDocument();
    expect(
      within(container).getByRole("button", { name: "Back to home" }),
    ).toBeInTheDocument();
  });

  it("renders a retryable error with Try again + Close", () => {
    const { container } = render(
      <GuestSessionShell
        state={{
          kind: "error",
          message: "Network error contacting collab relay: ECONNREFUSED",
          retryable: true,
        }}
        onRetry={vi.fn()}
        onLeave={vi.fn()}
      />,
    );
    expect(
      within(container).getByText(
        "Network error contacting collab relay: ECONNREFUSED",
      ),
    ).toBeInTheDocument();
    expect(
      within(container).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
    expect(
      within(container).getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("renders a non-retryable error without Try again", () => {
    const { container } = render(
      <GuestSessionShell
        state={{
          kind: "error",
          message: "Collab relay returned 404",
          retryable: false,
        }}
        onLeave={vi.fn()}
      />,
    );
    expect(
      within(container).getByText("Collab relay returned 404"),
    ).toBeInTheDocument();
    expect(
      within(container).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
    expect(
      within(container).queryByRole("button", { name: "Try again" }),
    ).toBeNull();
  });

  it("renders the ended state with a Close button", () => {
    const { container } = render(
      <GuestSessionShell
        state={{ kind: "ended", reason: "session_ended" }}
        onLeave={vi.fn()}
      />,
    );
    expect(
      within(container).getByText("The session has ended"),
    ).toBeInTheDocument();
    expect(
      within(container).getByRole("button", { name: "Close" }),
    ).toBeInTheDocument();
  });
});

describe("GuestSessionShell (interactions)", () => {
  it("calls onRetry when Try again is clicked", () => {
    const onRetry = vi.fn();
    const onLeave = vi.fn();
    const { container } = render(
      <GuestSessionShell
        state={{
          kind: "error",
          message: "Network error",
          retryable: true,
        }}
        onRetry={onRetry}
        onLeave={onLeave}
      />,
    );
    fireEvent.click(
      within(container).getByRole("button", { name: "Try again" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });
});
