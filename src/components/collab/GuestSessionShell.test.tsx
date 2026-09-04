// @vitest-environment jsdom
import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuestSessionShell } from "./GuestSessionShell";

describe("GuestSessionShell (snapshots)", () => {
  it("renders the disabled state when collab is not configured", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "disabled" }} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the missing-token error", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "missing-token" }} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the missing-host-key error", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "missing-host-key" }} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the connecting state with a spinner", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "connecting" }} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the awaiting-approval state with a spinner", () => {
    const { container } = render(
      <GuestSessionShell state={{ kind: "awaiting-approval" }} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the denied state with a Back to home button", () => {
    const { container } = render(
      <GuestSessionShell
        state={{ kind: "denied", reason: "not on the list" }}
        onLeave={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the denied state with a null reason (host gave none)", () => {
    const { container } = render(
      <GuestSessionShell
        state={{ kind: "denied", reason: null }}
        onLeave={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
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
    expect(container.firstChild).toMatchSnapshot();
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
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders the ended state with a Close button", () => {
    const { container } = render(
      <GuestSessionShell
        state={{ kind: "ended", reason: "session_ended" }}
        onLeave={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
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
