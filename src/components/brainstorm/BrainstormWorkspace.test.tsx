// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import {
  type BrainstormSetup,
  type BrainstormSetupId,
  BrainstormSetupSchema,
} from "@/db/schemas";
import { BrainstormWorkspace } from "./BrainstormWorkspace";

const ts = "2024-01-01T00:00:00.000Z";

function makeSetup(): BrainstormSetup {
  return BrainstormSetupSchema.parse({
    id: crypto.randomUUID() as BrainstormSetupId,
    name: "Fantasy",
    columns: [{ name: "hero", options: ["knight"] }],
    pattern: "A [hero] appears.",
    createdAt: ts,
    updatedAt: ts,
  });
}

function entryParagraph(text: string) {
  return screen.getByText(
    (_, el) => el?.tagName === "P" && el.textContent === text,
  );
}

beforeEach(async () => {
  await db.brainstormSetups.clear();
  await db.brainstormIdeas.clear();
});

describe("BrainstormWorkspace", () => {
  it("randomizes an entry from the pattern", () => {
    render(
      <BrainstormWorkspace
        setup={makeSetup()}
        onCreateProjectFromEntry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /randomize/i }));
    // The entry renders as separate spans; assert the joined paragraph text.
    expect(entryParagraph("A knight appears.")).toBeTruthy();
  });

  it("saves the rolled entry as an idea", async () => {
    render(
      <BrainstormWorkspace
        setup={makeSetup()}
        onCreateProjectFromEntry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /randomize/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(async () => {
      expect(await db.brainstormIdeas.count()).toBe(1);
    });
    const [saved] = await db.brainstormIdeas.toArray();
    expect(saved.ideaText).toBe("A knight appears.");
  });

  it("creates a project from the rolled entry", () => {
    const onCreateProject = vi.fn();
    render(
      <BrainstormWorkspace
        setup={makeSetup()}
        onCreateProjectFromEntry={onCreateProject}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /randomize/i }));
    fireEvent.click(screen.getByRole("button", { name: /create project/i }));

    expect(onCreateProject).toHaveBeenCalledWith("A knight appears.");
  });
});
