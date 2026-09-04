"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";

export interface IssueContextMenuAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}

export interface IssueContextMenuSuggestion {
  key: string;
  label: string;
  onSelect: () => void;
}

interface IssueContextMenuProps {
  anchorRect: DOMRect;
  /** Explanation of why the text was flagged, shown above the suggestions (grammar only). */
  message?: ReactNode;
  suggestions: IssueContextMenuSuggestion[];
  suggestionsEmptyLabel?: string;
  actions: IssueContextMenuAction[];
  onClose: () => void;
  className?: string;
}

export function IssueContextMenu({
  anchorRect,
  message,
  suggestions,
  suggestionsEmptyLabel = "No suggestions",
  actions,
  onClose,
  className,
}: IssueContextMenuProps) {
  return (
    <ContextMenu
      position={{ x: anchorRect.left, y: anchorRect.bottom + 4 }}
      onClose={onClose}
      className={className}
    >
      {message && (
        <>
          <div className="px-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            {message}
          </div>
          <ContextMenuSeparator />
        </>
      )}

      {suggestions.length > 0 ? (
        <>
          {suggestions.map((suggestion, index) => (
            <ContextMenuItem
              key={suggestion.key}
              prefix={
                <span className="text-xs text-neutral-400">{index + 1}</span>
              }
              onClick={suggestion.onSelect}
            >
              {suggestion.label}
            </ContextMenuItem>
          ))}
          <ContextMenuSeparator />
        </>
      ) : (
        <>
          <div className="px-3 py-1.5 text-sm italic text-neutral-500">
            {suggestionsEmptyLabel}
          </div>
          <ContextMenuSeparator />
        </>
      )}

      {actions.map((action) => (
        <ContextMenuItem
          key={action.key}
          icon={action.icon}
          onClick={action.onClick}
        >
          {action.label}
        </ContextMenuItem>
      ))}
    </ContextMenu>
  );
}
