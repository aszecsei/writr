// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, Chapter } from "@/db/schemas";
import type { RetrievalHit, RetrievalResult } from "@/lib/retrieval/types";
import { RetrievalPreviewDialog } from "./RetrievalPreviewDialog";

const settingsRef = vi.hoisted(() => ({
  current: {
    loreRetrievalEnabled: true,
    omniscientMode: true,
    loreTopK: 5,
    sceneTopK: 3,
    similarityFloor: 0.3,
  } as Partial<AppSettings>,
}));

vi.mock("@/hooks/data/useAppSettings", () => ({
  useAppSettings: () => settingsRef.current,
}));

function chapter(): Chapter {
  return {
    id: "ch-1",
    title: "Chapter One",
    content: "Once upon a time.",
  } as Chapter;
}

function hit(over: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    sourceId: "src-1",
    chunkIndex: 0,
    title: "A Hit",
    text: "Snippet text.",
    score: 0.812,
    ...over,
  };
}

function emptyResult(): RetrievalResult {
  return { lore: [], pastEvents: [], futureEvents: [] };
}

afterEach(() => {
  settingsRef.current = {
    loreRetrievalEnabled: true,
    omniscientMode: true,
    loreTopK: 5,
    sceneTopK: 3,
    similarityFloor: 0.3,
  };
});

describe("RetrievalPreviewDialog", () => {
  it("shows a loading state then the loaded results", async () => {
    let resolve!: (r: RetrievalResult) => void;
    const retrieve = vi.fn(
      () => new Promise<RetrievalResult>((r) => (resolve = r)),
    );

    render(
      <RetrievalPreviewDialog
        retrieve={retrieve}
        chapter={chapter()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Running retrieval/i)).toBeInTheDocument();

    resolve({
      lore: [hit({ sourceId: "lore-1", title: "The Old Pact" })],
      pastEvents: [],
      futureEvents: [],
    });

    await waitFor(() =>
      expect(screen.getByText("The Old Pact")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Running retrieval/i)).not.toBeInTheDocument();
  });

  it("calls retrieve with force so it runs even when disabled", async () => {
    const retrieve = vi.fn(async () => emptyResult());
    render(
      <RetrievalPreviewDialog
        retrieve={retrieve}
        chapter={chapter()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(retrieve).toHaveBeenCalled());
    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ch-1" }),
      { force: true },
    );
  });

  it("renders an Entity link badge for an infinite-scored hit and a numeric badge otherwise", async () => {
    const retrieve = vi.fn(async () => ({
      lore: [
        hit({
          sourceId: "linked",
          title: "Linked Doc",
          score: Number.POSITIVE_INFINITY,
        }),
        hit({ sourceId: "semantic", title: "Semantic Doc", score: 0.742 }),
      ],
      pastEvents: [],
      futureEvents: [],
    }));

    render(
      <RetrievalPreviewDialog
        retrieve={retrieve}
        chapter={chapter()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Linked Doc")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Entity link/i)).toBeInTheDocument();
    expect(screen.getByText("0.742")).toBeInTheDocument();
  });

  it("notes that future events are excluded when omniscient mode is off", async () => {
    settingsRef.current = { ...settingsRef.current, omniscientMode: false };
    const retrieve = vi.fn(async () => ({
      lore: [hit()],
      pastEvents: [],
      futureEvents: [],
    }));

    render(
      <RetrievalPreviewDialog
        retrieve={retrieve}
        chapter={chapter()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/Omniscient mode off/i)).toBeInTheDocument(),
    );
  });

  it("shows the disabled banner when retrieval is turned off", () => {
    settingsRef.current = {
      ...settingsRef.current,
      loreRetrievalEnabled: false,
    };
    const retrieve = vi.fn(async () => emptyResult());

    render(
      <RetrievalPreviewDialog
        retrieve={retrieve}
        chapter={chapter()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Retrieval is currently disabled/i),
    ).toBeInTheDocument();
  });

  it("shows an empty state when nothing is retrieved", async () => {
    const retrieve = vi.fn(async () => emptyResult());

    render(
      <RetrievalPreviewDialog
        retrieve={retrieve}
        chapter={chapter()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/No relevant context found/i),
      ).toBeInTheDocument(),
    );
  });
});
