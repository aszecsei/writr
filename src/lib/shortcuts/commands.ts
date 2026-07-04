import { createChapter } from "@/db/operations/chapters";
import { getTerm } from "@/lib/terminology";
import { useUiStore } from "@/store/uiStore";
import { type ShortcutRegistry, shortcutRegistry } from "./registry";
import type { Command, CommandContext } from "./types";

/** Guard: a command that operates on the open project needs one to be active. */
function hasProject(ctx: CommandContext): boolean {
  return ctx.projectId !== null;
}

/** Build a project-scoped navigation command bound to a `g …` chord. */
function navCommand(
  id: string,
  title: string,
  keys: string,
  /** Path under `/projects/{id}/`, e.g. `"bible/characters"`. */
  subPath: string,
): Command {
  return {
    id,
    title,
    category: "navigation",
    defaultKeys: keys,
    when: hasProject,
    run: (ctx) => {
      if (!ctx.projectId) return;
      const suffix = subPath ? `/${subPath}` : "";
      ctx.router.push(`/projects/${ctx.projectId}${suffix}`);
    },
  };
}

const NAVIGATION_COMMANDS: Command[] = [
  navCommand("nav.outline", "Go to Outline", "g o", "outline"),
  navCommand("nav.bible", "Go to Story Bible", "g b", "bible"),
  navCommand("nav.characters", "Go to Characters", "g c", "bible/characters"),
  navCommand("nav.locations", "Go to Locations", "g l", "bible/locations"),
  navCommand("nav.timeline", "Go to Timeline", "g t", "bible/timeline"),
  navCommand("nav.familyTree", "Go to Family Tree", "g f", "bible/family-tree"),
  navCommand("nav.styleGuide", "Go to Style Guide", "g s", "bible/style-guide"),
  navCommand(
    "nav.worldbuilding",
    "Go to Worldbuilding",
    "g w",
    "bible/worldbuilding",
  ),
  navCommand("nav.playlist", "Go to Playlist", "g p", "bible/playlist"),
  navCommand("nav.agents", "Go to Agents", "g a", "agents"),
];

/** Create a binder document in the given section, then open it. */
function createDocCommand(
  id: string,
  title: Command["title"],
  keys: string,
  section: "manuscript" | "scratchpad",
): Command {
  return {
    id,
    title,
    category: "create",
    defaultKeys: keys,
    when: hasProject,
    run: async (ctx) => {
      if (!ctx.projectId) return;
      const chapter = await createChapter({
        projectId: ctx.projectId,
        title: getTerm(ctx.projectMode, "untitledChapter"),
        section,
      });
      ctx.router.push(`/projects/${ctx.projectId}/chapters/${chapter.id}`);
    },
  };
}

const CREATE_COMMANDS: Command[] = [
  createDocCommand(
    "create.chapter",
    (mode) => getTerm(mode, "addChapter"),
    "n c",
    "manuscript",
  ),
  createDocCommand(
    "create.scratchpad",
    "New Scratchpad Document",
    "n s",
    "scratchpad",
  ),
];

const GENERAL_COMMANDS: Command[] = [
  {
    id: "general.search",
    title: "Focus search",
    category: "general",
    defaultKeys: "Mod+K",
    run: () => useUiStore.getState().requestSearchFocus(),
  },
  {
    id: "general.toggleFocusMode",
    title: "Toggle focus mode",
    category: "general",
    defaultKeys: "Mod+Shift+F",
    run: () => useUiStore.getState().toggleFocusMode(),
  },
  {
    id: "general.exitFocusMode",
    title: "Exit focus mode",
    category: "general",
    defaultKeys: "Escape",
    // Must fire while the editor is focused — focus mode's whole point is
    // distraction-free typing, so the user is almost always in the editor when
    // they hit Escape. Mirrors the old useFocusModeShortcuts window listener.
    allowInEditable: true,
    // Mirrors the old useFocusModeShortcuts semantics: only when focus mode is
    // on and the browser isn't handling Escape for fullscreen.
    when: () =>
      useUiStore.getState().focusModeEnabled &&
      typeof document !== "undefined" &&
      !document.fullscreenElement,
    run: () => useUiStore.getState().setFocusMode(false),
  },
  {
    id: "general.toggleSidebar",
    title: "Toggle sidebar",
    category: "general",
    defaultKeys: "Mod+\\",
    run: () => useUiStore.getState().toggleSidebar(),
  },
  {
    id: "general.toggleAiPanel",
    title: "Toggle AI panel",
    category: "general",
    defaultKeys: "Mod+J",
    run: () => useUiStore.getState().toggleRightPanelTab("ai"),
  },
  {
    id: "general.toggleAnalysisPanel",
    title: "Toggle analysis panel",
    category: "general",
    defaultKeys: "Mod+Shift+J",
    run: () => useUiStore.getState().toggleRightPanelTab("analysis"),
  },
  {
    id: "general.shortcutsHelp",
    title: "Show keyboard shortcuts",
    category: "general",
    defaultKeys: "?",
    run: () => useUiStore.getState().openModal({ id: "shortcuts-help" }),
  },
];

export const DEFAULT_COMMANDS: Command[] = [
  ...NAVIGATION_COMMANDS,
  ...CREATE_COMMANDS,
  ...GENERAL_COMMANDS,
];

/** Populate a registry with the default command set. Idempotent. */
export function registerDefaultCommands(registry: ShortcutRegistry): void {
  if (registry.size > 0) return;
  registry.registerAll(DEFAULT_COMMANDS);
}

// Self-register on import so every consumer (the dispatcher hook and the help
// overlay alike) sees a populated singleton without ordering assumptions.
registerDefaultCommands(shortcutRegistry);
