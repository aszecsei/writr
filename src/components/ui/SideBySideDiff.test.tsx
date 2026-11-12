// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SideBySideDiff } from "./SideBySideDiff";

describe("SideBySideDiff", () => {
  it("shows removed words only on the left and added words only on the right", () => {
    render(
      <SideBySideDiff
        before="the windows rattled in the gale"
        after="the windows shook in the gale"
        beforeLabel="Chapter 1"
        afterLabel="Chapter 4"
      />,
    );
    const before = screen.getByTestId("diff-before");
    const after = screen.getByTestId("diff-after");
    expect(before.textContent).toBe("the windows rattled in the gale");
    expect(after.textContent).toBe("the windows shook in the gale");
    expect(screen.getByText("rattled").closest("[data-testid]")).toBe(before);
    expect(screen.getByText("shook").closest("[data-testid]")).toBe(after);
  });
});
