"use client";

import { Dices } from "lucide-react";
import { useState } from "react";
import { BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { createBrainstormIdea, updateBrainstormSetup } from "@/db/operations";
import type { BrainstormColumn, BrainstormSetup } from "@/db/schemas";
import { type FillResult, fillPattern } from "@/lib/brainstorm";
import { ColumnEditor } from "./ColumnEditor";
import { EntryDisplay } from "./EntryDisplay";
import { PatternField } from "./PatternField";

interface BrainstormWorkspaceProps {
  /** The selected setup (live). Mount with key={setup.id} to reset state. */
  setup: BrainstormSetup;
  onCreateProjectFromEntry: (entryText: string) => void;
}

export function BrainstormWorkspace({
  setup,
  onCreateProjectFromEntry,
}: BrainstormWorkspaceProps) {
  const [name, setName] = useState(setup.name);
  const [result, setResult] = useState<FillResult | null>(null);
  const [copiedEntry, setCopiedEntry] = useState(false);
  const [savedEntry, setSavedEntry] = useState(false);

  function randomize() {
    setResult(fillPattern(setup.pattern, setup.columns));
    setSavedEntry(false);
  }

  async function copy(text: string, mark: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      mark(true);
      setTimeout(() => mark(false), 1500);
    } catch {
      // Clipboard can reject (permissions / insecure context); ignore.
    }
  }

  async function handleSave() {
    if (!result) return;
    await createBrainstormIdea({
      setupId: setup.id,
      ideaText: result.entry,
    });
    setSavedEntry(true);
  }

  function commitColumns(columns: BrainstormColumn[]) {
    void updateBrainstormSetup(setup.id, { columns });
  }

  function commitPattern(pattern: string) {
    void updateBrainstormSetup(setup.id, { pattern });
  }

  const canRandomize = setup.pattern.trim().length > 0;

  return (
    <div className="space-y-6">
      <label className={LABEL_CLASS}>
        Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => updateBrainstormSetup(setup.id, { name: name.trim() })}
          placeholder="Setup name"
          className={INPUT_CLASS}
        />
      </label>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Columns
        </h3>
        <ColumnEditor
          key={setup.id}
          columns={setup.columns}
          onCommit={commitColumns}
        />
      </section>

      <section>
        <PatternField
          key={setup.id}
          pattern={setup.pattern}
          columnNames={setup.columns.map((c) => c.name).filter(Boolean)}
          onCommit={commitPattern}
        />
      </section>

      <section className="space-y-3">
        <button
          type="button"
          onClick={randomize}
          disabled={!canRandomize}
          className={`inline-flex items-center gap-2 ${BUTTON_PRIMARY}`}
        >
          <Dices size={16} />
          Randomize
        </button>
        {!canRandomize && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Write a pattern above to randomize an entry.
          </p>
        )}

        {result && (
          <EntryDisplay
            result={result}
            onReroll={randomize}
            onCopy={() => copy(result.entry, setCopiedEntry)}
            copied={copiedEntry}
            onSave={handleSave}
            saved={savedEntry}
            onCreateProject={() => onCreateProjectFromEntry(result.entry)}
          />
        )}
      </section>
    </div>
  );
}
