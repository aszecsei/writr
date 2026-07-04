"use client";

import type { LucideIcon } from "lucide-react";
import { BarChart3, Info, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { AiPanel } from "@/components/ai/AiPanel";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import type { RightPanelTab } from "@/store/uiStore";
import { useUiStore } from "@/store/uiStore";
import { DetailsPanel } from "./DetailsPanel";

// Loaded on demand so the compromise NLP library the analysis panel pulls in
// stays out of the base bundle.
const AnalysisPanel = dynamic(
  () =>
    import("@/components/analysis/AnalysisPanel").then((m) => m.AnalysisPanel),
  { ssr: false },
);

/**
 * The combined right-hand panel: one container with an internal tab bar
 * (Details / Analysis / AI) and a close button. The TopBar has a single toggle
 * for the whole panel; tabs switch bodies here.
 */
export function RightPanel() {
  const tab = useUiStore((s) => s.rightPanel.tab);
  const openRightPanel = useUiStore((s) => s.openRightPanel);
  const closeRightPanel = useUiStore((s) => s.closeRightPanel);
  const aiEnabled = useAppSettings()?.enableAiFeatures ?? false;

  const tabs: { id: RightPanelTab; label: string; icon: LucideIcon }[] = [
    { id: "details", label: "Details", icon: Info },
    { id: "analysis", label: "Analysis", icon: BarChart3 },
    ...(aiEnabled ? [{ id: "ai" as const, label: "AI", icon: Sparkles }] : []),
  ];

  return (
    <div className="flex h-full flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex h-10 shrink-0 items-center justify-between gap-1 border-b border-neutral-200 pl-1 pr-2 dark:border-neutral-800">
        <div className="flex items-center gap-0.5">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => openRightPanel(id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === id
                  ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={closeRightPanel}
          className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          aria-label="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {tab === "details" && <DetailsPanel />}
        {tab === "analysis" && <AnalysisPanel />}
        {tab === "ai" && aiEnabled && <AiPanel />}
      </div>
    </div>
  );
}
