"use client";

import { BookOpen, Clapperboard, FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export type OutlineTemplate = "general" | "scene" | "custom";

interface OutlineTemplateDialogProps {
  onSelect: (template: OutlineTemplate) => void;
  onClose: () => void;
}

const TEMPLATES: {
  id: OutlineTemplate;
  icon: typeof BookOpen;
  title: string;
  description: string;
  columns: string[];
}[] = [
  {
    id: "general",
    icon: BookOpen,
    title: "General",
    description: "A versatile structure for most stories",
    columns: ["Time", "Plot", "Subplot", "Notes"],
  },
  {
    id: "scene",
    icon: Clapperboard,
    title: "Scene-based",
    description: "Track scene goals and conflicts",
    columns: ["Scene", "Goal", "Conflict", "Outcome"],
  },
  {
    id: "custom",
    icon: FileText,
    title: "Custom",
    description: "Start with a blank slate",
    columns: ["Notes"],
  },
];

export function OutlineTemplateDialog({
  onSelect,
  onClose,
}: OutlineTemplateDialogProps) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Choose an outline template
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Select a starting structure for your outline grid. You can add or
          remove columns later.
        </p>
      </div>

      <div className="space-y-3">
        {TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.id)}
              className="flex w-full items-start gap-4 rounded-lg border border-neutral-200 p-4 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <Icon
                  size={20}
                  className="text-neutral-600 dark:text-neutral-400"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                  {template.title}
                </h3>
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                  {template.description}
                </p>
                <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                  Columns: {template.columns.join(", ")}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export function getTemplateColumns(template: OutlineTemplate): string[] {
  const found = TEMPLATES.find((t) => t.id === template);
  return found?.columns ?? ["Notes"];
}
