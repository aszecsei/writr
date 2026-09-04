"use client";

import { Modal } from "@/components/ui/Modal";
import { useActiveProject } from "@/hooks/data/useProject";
import {
  type CommandCategory,
  commandTitle,
  formatBinding,
  shortcutRegistry,
} from "@/lib/shortcuts";
import { useUiStore } from "@/store/uiStore";

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: "Navigation",
  create: "Create",
  view: "View",
  general: "General",
};

const CATEGORY_ORDER: CommandCategory[] = [
  "navigation",
  "create",
  "view",
  "general",
];

export function ShortcutsHelpDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const projectMode = useActiveProject()?.mode ?? null;

  if (modal.id !== "shortcuts-help") return null;

  const groups = shortcutRegistry.byCategory();

  return (
    <Modal onClose={closeModal} maxWidth="max-w-lg" title="Keyboard Shortcuts">
      <div className="mt-4 space-y-5">
        {CATEGORY_ORDER.filter((category) => groups[category].length > 0).map(
          (category) => (
            <section key={category}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {CATEGORY_LABELS[category]}
              </h3>
              <ul className="space-y-1">
                {groups[category].map((command) => (
                  <li
                    key={command.id}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-neutral-700 dark:text-neutral-300">
                      {commandTitle(command, projectMode)}
                    </span>
                    <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                      {formatBinding(command.defaultKeys)}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ),
        )}
      </div>
    </Modal>
  );
}
