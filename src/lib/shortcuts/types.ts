import type { ProjectId, ProjectMode } from "@/db/schemas";

/**
 * Groupings used to organise commands in the shortcuts help overlay. Purely a
 * display concern — dispatch does not depend on category.
 */
export type CommandCategory = "navigation" | "create" | "view" | "general";

/**
 * The minimal router surface a command needs. Depending on this structural
 * interface rather than Next's concrete `AppRouterInstance` keeps the command
 * layer decoupled from the framework and trivially fakeable in tests.
 */
export interface CommandRouter {
  push: (href: string) => void;
}

/**
 * Runtime dependencies handed to a command when it runs. Store actions are
 * reached directly via `useXStore.getState()` inside handlers (the same pattern
 * TipTap extensions use), so only the router and the active-project context —
 * which can't be read statically — travel through here.
 */
export interface CommandContext {
  router: CommandRouter;
  projectId: ProjectId | null;
  projectMode: ProjectMode | null;
}

/**
 * A single globally-dispatchable action (Command pattern). `defaultKeys` is a
 * binding spec parsed by {@link import("./keys")}: either a chord sequence
 * (space-separated plain keys, e.g. `"g o"`) or a combo (`"Mod+Shift+F"`,
 * `"?"`). `title` may be a function so labels can follow prose/screenplay
 * terminology.
 */
export interface Command {
  id: string;
  title: string | ((mode: ProjectMode | null) => string);
  category: CommandCategory;
  defaultKeys: string;
  /** Optional guard; the command only runs when this returns true. */
  when?: (ctx: CommandContext) => boolean;
  /**
   * When true, this command still fires while an editable element (input,
   * textarea, contenteditable, ProseMirror) is focused, even without a
   * Ctrl/Meta modifier — e.g. Escape to exit focus mode while typing. By
   * default plain-key combos are suppressed in editable contexts so they
   * don't hijack typing.
   */
  allowInEditable?: boolean;
  run: (ctx: CommandContext) => void | Promise<void>;
}

/** Resolve a command's display title for a given project mode. */
export function commandTitle(
  command: Command,
  mode: ProjectMode | null,
): string {
  return typeof command.title === "function"
    ? command.title(mode)
    : command.title;
}
