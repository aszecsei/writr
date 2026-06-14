// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BrainstormColumn } from "@/db/schemas";
import { ColumnEditor } from "./ColumnEditor";

const cols = (...entries: [string, string[]][]): BrainstormColumn[] =>
  entries.map(([name, options]) => ({ name, options }));

describe("ColumnEditor collapse", () => {
  it("renders existing columns collapsed, hiding their options", () => {
    render(
      <ColumnEditor
        columns={cols(["hero", ["knight", "mage"]])}
        onCommit={vi.fn()}
      />,
    );

    // Options body is hidden; the header still shows the name and a count.
    expect(screen.queryByPlaceholderText("Option")).toBeNull();
    expect(screen.getByText("2 options")).toBeTruthy();
    expect(screen.getByRole("button", { name: /expand column/i })).toBeTruthy();
  });

  it("expands a collapsed column when its toggle is clicked", () => {
    render(
      <ColumnEditor
        columns={cols(["hero", ["knight", "mage"]])}
        onCommit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /expand column/i }));

    expect(screen.getAllByPlaceholderText("Option")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /collapse column/i }),
    ).toBeTruthy();
  });

  it("adds new columns expanded by default", () => {
    render(<ColumnEditor columns={[]} onCommit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /add column/i }));

    // The new column shows its (single, empty) option input immediately.
    expect(screen.getByPlaceholderText("Option")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /collapse column/i }),
    ).toBeTruthy();
  });
});
