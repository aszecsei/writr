"use client";

import { useEffect } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import {
  type AiToolId,
  BUILTIN_TOOL_IDS,
  type BuiltinAiTool,
} from "@/lib/ai/types";
import { useEditorStore } from "@/store/editorStore";

const BUILTIN_TOOL_LABELS: Record<BuiltinAiTool, string> = {
  "generate-prose": "Generate Prose",
  "review-text": "Review Text",
  "suggest-edits": "Suggest Edits",
  "character-dialogue": "Character Dialogue",
  brainstorm: "Brainstorm",
  summarize: "Summarize",
  "consistency-check": "Consistency Check",
};

interface ToolSelectorProps {
  value: AiToolId;
  onChange: (tool: AiToolId) => void;
}

export function ToolSelector({ value, onChange }: ToolSelectorProps) {
  const settings = useAppSettings();
  const selectedText = useEditorStore((s) => s.selectedText);

  const disabledTools = settings?.disabledBuiltinTools ?? [];
  const customTools = settings?.customTools ?? [];

  const enabledBuiltinTools = BUILTIN_TOOL_IDS.filter(
    (id) => !disabledTools.includes(id),
  );

  // Fall back to first available tool if current selection is disabled/deleted
  useEffect(() => {
    const isBuiltinDisabled = disabledTools.includes(value);
    const isCustomDeleted =
      !BUILTIN_TOOL_IDS.includes(value as BuiltinAiTool) &&
      !customTools.some((t) => t.id === value);

    if (isBuiltinDisabled || isCustomDeleted) {
      const fallback = enabledBuiltinTools[0] ?? customTools[0]?.id;
      if (fallback) {
        onChange(fallback);
      }
    }
  }, [value, disabledTools, customTools, enabledBuiltinTools, onChange]);

  const hasCustomTools = customTools.length > 0;

  const showSuggestEditsHint = value === "suggest-edits" && !selectedText;

  return (
    <>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AiToolId)}
        className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
      >
        {hasCustomTools ? (
          <>
            <optgroup label="Built-in">
              {enabledBuiltinTools.map((id) => (
                <option key={id} value={id}>
                  {BUILTIN_TOOL_LABELS[id]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Custom">
              {customTools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          </>
        ) : (
          enabledBuiltinTools.map((id) => (
            <option key={id} value={id}>
              {BUILTIN_TOOL_LABELS[id]}
            </option>
          ))
        )}
      </select>
      {showSuggestEditsHint && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Tip: Select text in the editor for targeted edit suggestions.
        </p>
      )}
    </>
  );
}
