import { describe, expect, it } from "vitest";
import { ShortcutRegistry } from "./registry";
import type { Command } from "./types";

function cmd(
  overrides: Partial<Command> & Pick<Command, "id" | "defaultKeys">,
): Command {
  return {
    title: overrides.id,
    category: "general",
    run: () => {},
    ...overrides,
  };
}

describe("ShortcutRegistry", () => {
  it("throws on a duplicate id", () => {
    const registry = new ShortcutRegistry();
    registry.register(cmd({ id: "a", defaultKeys: "Mod+A" }));
    expect(() =>
      registry.register(cmd({ id: "a", defaultKeys: "Mod+B" })),
    ).toThrow(/Duplicate shortcut command id/);
  });

  it("throws on a colliding binding regardless of case/whitespace", () => {
    const registry = new ShortcutRegistry();
    registry.register(cmd({ id: "a", defaultKeys: "Mod+A" }));
    expect(() =>
      registry.register(cmd({ id: "b", defaultKeys: "mod+a" })),
    ).toThrow(/Binding conflict/);
  });

  it("registers, retrieves, and groups commands by category in insertion order", () => {
    const registry = new ShortcutRegistry();
    const nav1 = cmd({
      id: "nav1",
      defaultKeys: "g a",
      category: "navigation",
    });
    registry.registerAll([
      nav1,
      cmd({ id: "gen1", defaultKeys: "?", category: "general" }),
      cmd({ id: "nav2", defaultKeys: "g b", category: "navigation" }),
    ]);
    expect(registry.size).toBe(3);
    expect(registry.get("nav1")).toBe(nav1);

    const groups = registry.byCategory();
    expect(groups.navigation.map((c) => c.id)).toEqual(["nav1", "nav2"]);
    expect(groups.general.map((c) => c.id)).toEqual(["gen1"]);
    expect(groups.create).toEqual([]);
  });
});
