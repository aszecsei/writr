// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DialogFooter } from "./DialogFooter";

describe("DialogFooter", () => {
  it("renders the default Save/Cancel pair", () => {
    const { container } = render(<DialogFooter onCancel={vi.fn()} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders a danger-variant submit", () => {
    const { container } = render(
      <DialogFooter onCancel={vi.fn()} submitLabel="Delete" variant="danger" />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders with a left slot and a custom submit child", () => {
    const { container } = render(
      <DialogFooter
        onCancel={vi.fn()}
        left={<button type="button">View History</button>}
        submitChildren={<span>Apply</span>}
        submitType="button"
        onSubmit={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
