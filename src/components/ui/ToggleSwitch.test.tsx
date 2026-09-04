// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToggleSwitch } from "./ToggleSwitch";

describe("ToggleSwitch", () => {
  it("renders unchecked", () => {
    render(
      <ToggleSwitch checked={false} onChange={() => {}} label="Preview" />,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(
      screen.queryByText("Highlight sentences in the editor by length"),
    ).toBeNull();
  });

  it("renders checked with a caption", () => {
    render(
      <ToggleSwitch
        checked={true}
        onChange={() => {}}
        label="Preview"
        caption="Highlight sentences in the editor by length"
      />,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(
      screen.queryByText("Highlight sentences in the editor by length"),
    ).toBeInTheDocument();
  });

  it("reports the inverted state on click", () => {
    const onChange = vi.fn();
    render(
      <ToggleSwitch checked={false} onChange={onChange} label="Preview" />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("does not fire when disabled", () => {
    const onChange = vi.fn();
    render(
      <ToggleSwitch
        checked={false}
        onChange={onChange}
        label="Preview"
        disabled
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
