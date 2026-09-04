// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DialogFooter } from "./DialogFooter";

describe("DialogFooter", () => {
  it("renders the default Save/Cancel pair", () => {
    const onCancel = vi.fn();
    render(<DialogFooter onCancel={onCancel} />);

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("type", "submit");
    expect(save.className).toContain("bg-primary-600");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders a danger-variant submit", () => {
    render(
      <DialogFooter onCancel={vi.fn()} submitLabel="Delete" variant="danger" />,
    );

    const submit = screen.getByRole("button", { name: "Delete" });
    expect(submit.className).toContain("bg-red-600");
  });

  it("disables the submit button when submitDisabled is set", () => {
    render(<DialogFooter onCancel={vi.fn()} submitDisabled />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("renders with a left slot and a custom submit child", () => {
    const onSubmit = vi.fn();
    render(
      <DialogFooter
        onCancel={vi.fn()}
        left={<button type="button">View History</button>}
        submitChildren={<span>Apply</span>}
        submitType="button"
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByRole("button", { name: "View History" }),
    ).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Apply" });
    expect(submit).toHaveAttribute("type", "button");

    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
