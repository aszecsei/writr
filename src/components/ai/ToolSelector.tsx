"use client";

import { useEffect, useMemo } from "react";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useCustomAgents } from "@/hooks/data/useCustomAgents";
import {
  type AiToolId,
  BUILTIN_TOOL_IDS,
  type BuiltinAiTool,
} from "@/lib/ai/types";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

const BUILTIN_TOOL_LABELS: Record<BuiltinAiTool, string> = {
  "generate-prose": "Generate Prose",
  "review-text": "Review Text",
  "suggest-edits": "Suggest Edits",
  "character-dialogue": "Character Dialogue",
  brainstorm: "Brainstorm",
  summarize: "Summarize",
  "consistency-check": "Consistency Check",
};

/** Prefix used in the dropdown value to distinguish a CustomAgent id from a
 * regular task-tool / customTool id. AiPanel detects this prefix and switches
 * to the custom-agent execution path. */
export const CUSTOM_AGENT_PREFIX = "agent:";

export function isCustomAgentSelection(value: AiToolId): boolean {
  return typeof value === "string" && value.startsWith(CUSTOM_AGENT_PREFIX);
}

export function customAgentIdFromSelection(value: AiToolId): string {
  return value.slice(CUSTOM_AGENT_PREFIX.length);
}

interface ToolSelectorProps {
  value: AiToolId;
  onChange: (tool: AiToolId) => void;
}

export function ToolSelector({ value, onChange }: ToolSelectorProps) {
  const settings = useAppSettings();
  const selectedText = useEditorStore((s) => s.selectedText);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const customAgents = useCustomAgents(activeProjectId);

  const disabledTools = settings?.disabledBuiltinTools ?? [];
  const customTools = settings?.customTools ?? [];

  const enabledBuiltinTools = useMemo(
    () => BUILTIN_TOOL_IDS.filter((id) => !disabledTools.includes(id)),
    [disabledTools],
  );

  // Fall back to first available selection if current one disappeared.
  useEffect(() => {
    const isBuiltinDisabled =
      BUILTIN_TOOL_IDS.includes(value as BuiltinAiTool) &&
      disabledTools.includes(value);
    const isCustomToolDeleted =
      !isCustomAgentSelection(value) &&
      !BUILTIN_TOOL_IDS.includes(value as BuiltinAiTool) &&
      !customTools.some((t) => t.id === value);
    const isCustomAgentDeleted =
      isCustomAgentSelection(value) &&
      customAgents !== undefined &&
      !customAgents.some((a) => a.id === customAgentIdFromSelection(value));

    if (isBuiltinDisabled || isCustomToolDeleted || isCustomAgentDeleted) {
      const fallback = enabledBuiltinTools[0] ?? customTools[0]?.id;
      if (fallback) {
        onChange(fallback);
      }
    }
  }, [
    value,
    disabledTools,
    customTools,
    customAgents,
    enabledBuiltinTools,
    onChange,
  ]);

  const hasCustomTools = customTools.length > 0;
  const hasCustomAgents = (customAgents?.length ?? 0) > 0;

  const showSuggestEditsHint = value === "suggest-edits" && !selectedText;

  return (
    <>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AiToolId)}
        className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
      >
        {hasCustomTools || hasCustomAgents ? (
          <>
            <optgroup label="Built-in">
              {enabledBuiltinTools.map((id) => (
                <option key={id} value={id}>
                  {BUILTIN_TOOL_LABELS[id]}
                </option>
              ))}
            </optgroup>
            {hasCustomTools && (
              <optgroup label="Custom Tools">
                {customTools.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            {hasCustomAgents && customAgents && (
              <optgroup label="Custom Agents">
                {customAgents.map((a) => (
                  <option key={a.id} value={`${CUSTOM_AGENT_PREFIX}${a.id}`}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
            )}
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
