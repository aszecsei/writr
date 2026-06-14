"use client";

import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { INPUT_CLASS } from "@/components/ui/form-styles";
import type { BrainstormColumn } from "@/db/schemas";

interface ColumnEditorProps {
  columns: BrainstormColumn[];
  /** Called whenever the column structure or a field is committed (on blur). */
  onCommit: (columns: BrainstormColumn[]) => void;
}

// Local editable model with stable ids so list keys survive add/remove and
// text edits without focus loss (the persisted shape has no ids).
interface EditOption {
  id: string;
  value: string;
}
interface EditColumn {
  id: string;
  name: string;
  options: EditOption[];
  // UI-only: whether the options body is hidden. Not persisted — existing
  // columns seed collapsed, freshly added ones start expanded.
  collapsed: boolean;
}

function seed(columns: BrainstormColumn[]): EditColumn[] {
  return columns.map((column) => ({
    id: crypto.randomUUID(),
    name: column.name,
    options: column.options.map((value) => ({
      id: crypto.randomUUID(),
      value,
    })),
    collapsed: true,
  }));
}

function toColumns(model: EditColumn[]): BrainstormColumn[] {
  return model.map((column) => ({
    name: column.name,
    options: column.options.map((option) => option.value),
  }));
}

/**
 * Editable list of named columns, each holding a list of option strings.
 * Mount with `key={setupId}` so switching setups resets local state.
 * Text edits update local state and persist on blur; structural changes
 * (add/remove) persist immediately.
 */
export function ColumnEditor({
  columns: initial,
  onCommit,
}: ColumnEditorProps) {
  const [columns, setColumns] = useState<EditColumn[]>(() => seed(initial));

  function commit(next: EditColumn[]) {
    setColumns(next);
    onCommit(toColumns(next));
  }

  function addColumn() {
    commit([
      ...columns,
      {
        id: crypto.randomUUID(),
        name: "",
        options: [{ id: crypto.randomUUID(), value: "" }],
        collapsed: false,
      },
    ]);
  }

  function toggleCollapse(columnId: string) {
    setColumns((prev) =>
      prev.map((column) =>
        column.id === columnId
          ? { ...column, collapsed: !column.collapsed }
          : column,
      ),
    );
  }

  function removeColumn(columnId: string) {
    commit(columns.filter((column) => column.id !== columnId));
  }

  function setColumnName(columnId: string, name: string) {
    setColumns((prev) =>
      prev.map((column) =>
        column.id === columnId ? { ...column, name } : column,
      ),
    );
  }

  function addOption(columnId: string) {
    commit(
      columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              options: [
                ...column.options,
                { id: crypto.randomUUID(), value: "" },
              ],
            }
          : column,
      ),
    );
  }

  function removeOption(columnId: string, optionId: string) {
    commit(
      columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              options: column.options.filter(
                (option) => option.id !== optionId,
              ),
            }
          : column,
      ),
    );
  }

  function setOption(columnId: string, optionId: string, value: string) {
    setColumns((prev) =>
      prev.map((column) =>
        column.id === columnId
          ? {
              ...column,
              options: column.options.map((option) =>
                option.id === optionId ? { ...option, value } : option,
              ),
            }
          : column,
      ),
    );
  }

  function handleBlur() {
    onCommit(toColumns(columns));
  }

  return (
    <div className="space-y-4">
      {columns.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No columns yet. Add one to start building your pattern.
        </p>
      )}

      {columns.map((column) => (
        <div
          key={column.id}
          className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleCollapse(column.id)}
              aria-expanded={!column.collapsed}
              aria-label={
                column.collapsed ? "Expand column" : "Collapse column"
              }
              className="shrink-0 rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              {column.collapsed ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
            <input
              type="text"
              value={column.name}
              onChange={(e) => setColumnName(column.id, e.target.value)}
              onBlur={handleBlur}
              placeholder="Column name (e.g. character)"
              className={`${INPUT_CLASS} mt-0 font-medium`}
            />
            {column.collapsed && (
              <span className="shrink-0 whitespace-nowrap text-xs text-neutral-500 dark:text-neutral-400">
                {column.options.length}{" "}
                {column.options.length === 1 ? "option" : "options"}
              </span>
            )}
            <button
              type="button"
              onClick={() => removeColumn(column.id)}
              aria-label="Remove column"
              className="shrink-0 rounded-md p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {!column.collapsed && (
            <div className="mt-3 space-y-2">
              {column.options.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option.value}
                    onChange={(e) =>
                      setOption(column.id, option.id, e.target.value)
                    }
                    onBlur={handleBlur}
                    placeholder="Option"
                    className={`${INPUT_CLASS} mt-0`}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(column.id, option.id)}
                    aria-label="Remove option"
                    className="shrink-0 rounded-md p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(column.id)}
                className="inline-flex items-center gap-1 text-sm text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                <Plus size={14} />
                Add option
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addColumn}
        className="inline-flex items-center gap-2 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
      >
        <Plus size={16} />
        Add column
      </button>
    </div>
  );
}
