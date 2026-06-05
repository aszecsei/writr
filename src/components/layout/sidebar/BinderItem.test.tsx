// @vitest-environment jsdom
import { DragDropProvider } from "@dnd-kit/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Chapter, ChapterId, ProjectId } from "@/db/schemas";
import {
  buildTree,
  type FlatRow,
  flattenForDnd,
  subtreeWordCounts,
} from "@/lib/binder/tree";
import { makeChapter } from "@/test/helpers";
import { BinderItem, type BinderItemShared } from "./BinderItem";

const projectId = "00000000-0000-4000-8000-0000000000aa" as ProjectId;
const parentId = "00000000-0000-4000-8000-00000000000a" as ChapterId;
const childId = "00000000-0000-4000-8000-00000000000b" as ChapterId;
const sepId = "00000000-0000-4000-8000-00000000000c" as ChapterId;

const folderFixture = (): Chapter[] => [
  makeChapter({
    projectId,
    id: parentId,
    title: "Chapter One",
    wordCount: 100,
  }),
  makeChapter({
    projectId,
    id: childId,
    parentChapterId: parentId,
    title: "Scene A",
    wordCount: 30,
  }),
];

function rowsFor(items: Chapter[]): {
  rows: FlatRow[];
  shared: (overrides?: Partial<BinderItemShared>) => BinderItemShared;
} {
  const tree = buildTree(items, "manuscript");
  const rows = flattenForDnd(tree, {});
  const totals = subtreeWordCounts(tree);
  const shared = (
    overrides: Partial<BinderItemShared> = {},
  ): BinderItemShared => ({
    projectId,
    pathname: "/",
    subtreeTotals: totals,
    collapsed: {},
    renamingChapterId: null,
    renameValue: "",
    renameInputRef: { current: null },
    onToggleCollapsed: vi.fn(),
    onRenameChange: vi.fn(),
    onRenameCommit: vi.fn(),
    onRenameKeyDown: vi.fn(),
    onContextMenu: vi.fn(),
    onSeparatorOpen: vi.fn(),
    ...overrides,
  });
  return { rows, shared };
}

/** Rows use `useSortable`, which requires a DragDropProvider ancestor. */
function renderRow(row: FlatRow, index: number, shared: BinderItemShared) {
  return render(
    <DragDropProvider>
      <BinderItem row={row} index={index} shared={shared} />
    </DragDropProvider>,
  );
}

describe("BinderItem", () => {
  it("shows a folder's subtree total plus its own count, muted", () => {
    const { rows, shared } = rowsFor(folderFixture());
    const { container } = renderRow(rows[0], 0, shared());
    expect(container.textContent).toContain("Chapter One");
    expect(container.textContent).toContain("130"); // 100 + 30 subtree total
    expect(container.textContent).toContain("(100)"); // own count, muted
  });

  it("shows only the own count for a leaf (no rollup parentheses)", () => {
    const { rows, shared } = rowsFor(folderFixture());
    const { container } = renderRow(rows[1], 1, shared());
    expect(container.textContent).toContain("Scene A");
    expect(container.textContent).toContain("30");
    expect(container.textContent).not.toContain("(");
  });

  it("toggles collapse when the chevron is clicked", () => {
    const { rows, shared } = rowsFor(folderFixture());
    const onToggleCollapsed = vi.fn();
    renderRow(rows[0], 0, shared({ onToggleCollapsed }));
    fireEvent.click(screen.getByLabelText("Collapse"));
    expect(onToggleCollapsed).toHaveBeenCalledWith(parentId);
  });

  it("renders a separator as a labelled divider without a link", () => {
    const { rows, shared } = rowsFor([
      makeChapter({
        projectId,
        id: sepId,
        title: "Part One",
        kind: "separator",
      }),
    ]);
    const { container } = renderRow(rows[0], 0, shared());
    expect(container.textContent).toContain("Part One");
    expect(container.querySelector("a")).toBeNull();
  });

  it("toggles collapse when a separator's chevron is clicked", () => {
    const { rows, shared } = rowsFor([
      makeChapter({
        projectId,
        id: sepId,
        title: "Part One",
        kind: "separator",
      }),
    ]);
    const onToggleCollapsed = vi.fn();
    renderRow(rows[0], 0, shared({ onToggleCollapsed }));
    fireEvent.click(screen.getByLabelText("Collapse"));
    expect(onToggleCollapsed).toHaveBeenCalledWith(sepId);
  });
});
