// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/database";
import type { ProjectId } from "@/db/schemas";
import { useUiStore } from "@/store/uiStore";
import { DEFAULT_COMMANDS } from "./commands";
import type { Command, CommandContext } from "./types";

const projectId = "00000000-0000-4000-8000-0000000000aa" as ProjectId;

function command(id: string): Command {
  const found = DEFAULT_COMMANDS.find((c) => c.id === id);
  if (!found) throw new Error(`no command ${id}`);
  return found;
}

function context(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    router: { push: vi.fn() },
    projectId,
    projectMode: "prose",
    ...overrides,
  };
}

describe("navigation commands", () => {
  it("push the project-scoped route", () => {
    const ctx = context();
    command("nav.characters").run(ctx);
    expect(ctx.router.push).toHaveBeenCalledWith(
      `/projects/${projectId}/bible/characters`,
    );
  });

  it("are guarded off when no project is active", () => {
    const ctx = context({ projectId: null });
    const nav = command("nav.outline");
    expect(nav.when?.(ctx)).toBe(false);
  });
});

describe("create commands", () => {
  beforeEach(async () => {
    await db.chapters.clear();
  });

  it("create a manuscript document and open it", async () => {
    const ctx = context();
    await command("create.chapter").run(ctx);

    const chapters = await db.chapters.where({ projectId }).toArray();
    expect(chapters).toHaveLength(1);
    expect(chapters[0].section).toBe("manuscript");
    expect(chapters[0].title).toBe("Untitled Chapter");
    expect(ctx.router.push).toHaveBeenCalledWith(
      `/projects/${projectId}/chapters/${chapters[0].id}`,
    );
  });

  it("create a scratchpad document in the scratchpad section", async () => {
    await command("create.scratchpad").run(context());
    const chapters = await db.chapters.where({ projectId }).toArray();
    expect(chapters[0].section).toBe("scratchpad");
  });

  it("title follows screenplay terminology", async () => {
    await command("create.chapter").run(context({ projectMode: "screenplay" }));
    const chapters = await db.chapters.where({ projectId }).toArray();
    expect(chapters[0].title).toBe("Untitled Sequence");
  });
});

describe("general commands", () => {
  beforeEach(() => {
    useUiStore.setState({
      modal: { id: null },
      focusModeEnabled: false,
      searchFocusToken: 0,
    });
  });

  it("focus search bumps the focus token", () => {
    command("general.search").run(context());
    expect(useUiStore.getState().searchFocusToken).toBe(1);
  });

  it("toggle focus mode flips the flag", () => {
    command("general.toggleFocusMode").run(context());
    expect(useUiStore.getState().focusModeEnabled).toBe(true);
  });

  it("exit focus mode is gated on focus mode being enabled", () => {
    const exit = command("general.exitFocusMode");
    expect(exit.when?.(context())).toBe(false);
    useUiStore.setState({ focusModeEnabled: true });
    expect(exit.when?.(context())).toBe(true);
  });

  it("shortcuts help opens the help modal", () => {
    command("general.shortcutsHelp").run(context());
    expect(useUiStore.getState().modal.id).toBe("shortcuts-help");
  });
});
