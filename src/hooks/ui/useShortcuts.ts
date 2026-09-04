"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useActiveProject } from "@/hooks/data/useProject";
import {
  bufferMatches,
  ChordTracker,
  type Command,
  type CommandContext,
  isMac,
  isPlainKey,
  matchCombo,
  type ParsedCombo,
  parseBinding,
  shortcutRegistry,
} from "@/lib/shortcuts";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return target.closest(".ProseMirror") !== null;
}

/**
 * Mounts the single global keyboard-shortcut listener (Command pattern
 * dispatcher). Intended to be rendered exactly once, near the app root.
 *
 * Guards: dispatch is suppressed while a modal is open (so modal Escape/own
 * handlers win) and while the user is typing in an editable element (combos
 * carrying a Ctrl/Meta modifier still fire, so `Mod+K` works mid-typing).
 */
export function useShortcuts(): void {
  const router = useRouter();
  const projectId = useProjectStore((s) => s.activeProjectId);
  const projectMode = useActiveProject()?.mode ?? null;

  // Latest context, read by the stable listener so it never needs rebinding.
  const ctxRef = useRef<CommandContext>({ router, projectId, projectMode });
  ctxRef.current = { router, projectId, projectMode };

  useEffect(() => {
    // Commands self-register on import of "@/lib/shortcuts"; the singleton is
    // already populated by the time this effect runs.
    const mac = isMac();
    const combos: { command: Command; combo: ParsedCombo }[] = [];
    const sequences: { command: Command; tokens: string[] }[] = [];
    for (const command of shortcutRegistry.all()) {
      const parsed = parseBinding(command.defaultKeys);
      if (parsed.kind === "combo") {
        combos.push({ command, combo: parsed.combo });
      } else {
        sequences.push({ command, tokens: parsed.tokens });
      }
    }
    const tracker = new ChordTracker();

    function dispatch(command: Command, e: KeyboardEvent): boolean {
      const ctx = ctxRef.current;
      if (command.when && !command.when(ctx)) return false;
      e.preventDefault();
      void command.run(ctx);
      return true;
    }

    function handleKeyDown(e: KeyboardEvent) {
      // While a modal is open, defer entirely to its own handlers.
      if (useUiStore.getState().modal.id !== null) return;

      const editable = isEditableTarget(e.target);

      for (const { command, combo } of combos) {
        if (!matchCombo(combo, e, mac)) continue;
        const hasModifier = combo.mod || combo.ctrl || combo.meta || combo.alt;
        if (editable && !hasModifier && !command.allowInEditable) continue;
        if (dispatch(command, e)) return;
      }

      if (editable || !isPlainKey(e)) return;

      const buffer = tracker.push(e.key, Date.now());
      for (const { command, tokens } of sequences) {
        if (bufferMatches(buffer, tokens) && dispatch(command, e)) {
          tracker.reset();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
