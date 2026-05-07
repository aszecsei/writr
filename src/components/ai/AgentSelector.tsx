"use client";

import { useEffect } from "react";
import type { AgentDefinitionId } from "@/db/schemas";
import { useChatAgents } from "@/hooks/data/useAgents";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

interface AgentSelectorProps {
  value: AgentDefinitionId | null;
  onChange: (agentId: AgentDefinitionId) => void;
}

/**
 * Dropdown of all chat-mode agents (built-ins + user-created). No
 * Built-in/Custom split — every agent looks the same. The previous
 * `ToolSelector` predecessor distinguished built-in tools, custom tools,
 * and custom agents in three optgroups; with the unified Agents model,
 * none of those distinctions remain in the UI.
 */
export function AgentSelector({ value, onChange }: AgentSelectorProps) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const agents = useChatAgents(activeProjectId);
  const selectedText = useEditorStore((s) => s.selectedText);

  // If the current selection vanished (e.g. user deleted the agent), fall
  // back to the first available.
  useEffect(() => {
    if (!agents) return;
    if (agents.length === 0) return;
    if (!value || !agents.some((a) => a.id === value)) {
      onChange(agents[0].id);
    }
  }, [agents, value, onChange]);

  const selected = agents?.find((a) => a.id === value);
  const showEditorHint = selected?.kind === "editor" && !selectedText;

  return (
    <>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as AgentDefinitionId)}
        className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
      >
        {agents?.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      {showEditorHint && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Tip: Select text in the editor for targeted edit suggestions.
        </p>
      )}
    </>
  );
}
