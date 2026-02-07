"use client";

import type { AiTool } from "@/lib/ai/types";

const AI_TOOLS: { id: AiTool; label: string }[] = [
  { id: "generate-prose", label: "Generate Prose" },
  { id: "review-text", label: "Review Text" },
  { id: "suggest-edits", label: "Suggest Edits" },
  { id: "character-dialogue", label: "Character Dialogue" },
  { id: "brainstorm", label: "Brainstorm" },
  { id: "summarize", label: "Summarize" },
  { id: "consistency-check", label: "Consistency Check" },
];

interface ToolSelectorProps {
  value: AiTool;
  onChange: (tool: AiTool) => void;
}

export function ToolSelector({ value, onChange }: ToolSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AiTool)}
      className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
    >
      {AI_TOOLS.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
