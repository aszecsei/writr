"use client";

import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrainstormWorkspace } from "@/components/brainstorm/BrainstormWorkspace";
import { SavedIdeasList } from "@/components/brainstorm/SavedIdeasList";
import { SetupList } from "@/components/brainstorm/SetupList";
import { CreateProjectDialog } from "@/components/dashboard/CreateProjectDialog";
import { SettingsModals } from "@/components/settings/SettingsModals";
import { Spinner } from "@/components/ui/Spinner";
import type { BrainstormSetupId } from "@/db/schemas";
import { useBrainstormSetups } from "@/hooks/data";
import { useUiStore } from "@/store/uiStore";

export default function BrainstormPage() {
  const setups = useBrainstormSetups();
  const openModal = useUiStore((s) => s.openModal);

  const [selectedId, setSelectedId] = useState<BrainstormSetupId | null>(null);

  // Keep the selection valid: default to the first setup, and clear it if the
  // selected setup is deleted.
  useEffect(() => {
    if (!setups) return;
    if (selectedId && setups.some((s) => s.id === selectedId)) return;
    setSelectedId(setups[0]?.id ?? null);
  }, [setups, selectedId]);

  const selectedSetup = setups?.find((s) => s.id === selectedId) ?? null;

  function createProjectFromText(text: string) {
    openModal({ id: "create-project", prefill: { description: text } });
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70 dark:border-neutral-800/80 dark:bg-neutral-900/80 dark:supports-[backdrop-filter]:bg-neutral-900/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to projects"
              className="flex items-center justify-center rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1
              className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
              style={{ fontFamily: "var(--font-literata), Georgia, serif" }}
            >
              Brainstorm
            </h1>
          </div>
          <button
            type="button"
            onClick={() => openModal({ id: "app-settings" })}
            className="flex items-center justify-center rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="App Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {setups === undefined ? (
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[200px_1fr]">
            <aside>
              <SetupList
                setups={setups}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </aside>

            <div className="space-y-10">
              {selectedSetup ? (
                <BrainstormWorkspace
                  key={selectedSetup.id}
                  setup={selectedSetup}
                  onCreateProjectFromEntry={createProjectFromText}
                />
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Create a setup to start brainstorming.
                </p>
              )}

              <SavedIdeasList onCreateProject={createProjectFromText} />
            </div>
          </div>
        )}
      </main>

      <CreateProjectDialog />
      <SettingsModals />
    </div>
  );
}
