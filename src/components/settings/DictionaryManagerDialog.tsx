"use client";

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import {
  BUTTON_PRIMARY,
  RADIO_ACTIVE,
  RADIO_BASE,
  RADIO_INACTIVE,
} from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import {
  addWordToAppDictionary,
  addWordToProjectDictionary,
  removeWordFromAppDictionary,
  removeWordFromProjectDictionary,
} from "@/db/operations/dictionary";
import {
  useAppDictionary,
  useProjectDictionary,
} from "@/hooks/data/useDictionary";
import { useProjectStore } from "@/store/projectStore";
import { useUiStore } from "@/store/uiStore";

type Tab = "app" | "project";

export function DictionaryManagerDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectTitle = useProjectStore((s) => s.activeProjectTitle);

  const appDict = useAppDictionary();
  const projectDict = useProjectDictionary(activeProjectId ?? undefined);

  const [tab, setTab] = useState<Tab>("app");
  const [addInput, setAddInput] = useState("");
  const [filter, setFilter] = useState("");

  if (modal.id !== "dictionary-manager") return null;

  const effectiveTab = tab === "project" && !activeProjectId ? "app" : tab;

  const words =
    effectiveTab === "app"
      ? (appDict?.words ?? [])
      : (projectDict?.words ?? []);

  const filteredWords = filter
    ? words.filter((w) => w.includes(filter.toLowerCase()))
    : words;

  async function handleAdd() {
    const word = addInput.trim();
    if (!word) return;
    if (effectiveTab === "app") {
      await addWordToAppDictionary(word);
    } else if (activeProjectId) {
      await addWordToProjectDictionary(activeProjectId, word);
    }
    setAddInput("");
  }

  async function handleRemove(word: string) {
    if (effectiveTab === "app") {
      await removeWordFromAppDictionary(word);
    } else if (activeProjectId) {
      await removeWordFromProjectDictionary(activeProjectId, word);
    }
  }

  return (
    <Modal onClose={closeModal} maxWidth="max-w-lg">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Dictionary Manager
      </h2>

      {/* Tab bar */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className={`${RADIO_BASE} ${effectiveTab === "app" ? RADIO_ACTIVE : RADIO_INACTIVE}`}
          onClick={() => setTab("app")}
        >
          App Dictionary
        </button>
        {activeProjectId && (
          <button
            type="button"
            className={`${RADIO_BASE} ${effectiveTab === "project" ? RADIO_ACTIVE : RADIO_INACTIVE}`}
            onClick={() => setTab("project")}
          >
            {activeProjectTitle ?? "Project"} Dictionary
          </button>
        )}
      </div>

      {/* Add word row */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a word..."
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!addInput.trim()}
          className={BUTTON_PRIMARY}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Filter input */}
      <div className="relative mt-3">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter words..."
          className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-8 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
      </div>

      {/* Word count */}
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {filteredWords.length} word{filteredWords.length !== 1 && "s"}
        {filter && ` matching "${filter}"`}
        {!filter &&
          ` in ${effectiveTab === "app" ? "app" : "project"} dictionary`}
      </p>

      {/* Word list */}
      <div className="mt-2 max-h-[400px] overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700">
        {filteredWords.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
            {filter
              ? "No words match your filter."
              : "No words in this dictionary yet."}
          </p>
        ) : (
          <ul>
            {filteredWords.map((word) => (
              <li
                key={word}
                className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 last:border-b-0 dark:border-neutral-800"
              >
                <span className="text-sm text-neutral-900 dark:text-neutral-100">
                  {word}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(word)}
                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-neutral-500 dark:hover:bg-red-950 dark:hover:text-red-400"
                  aria-label={`Remove "${word}"`}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
