"use client";

import { Download, Loader2, X } from "lucide-react";
import { useState } from "react";
import {
  type ExportFormat,
  type ExportScope,
  performExport,
} from "@/lib/export";
import { useUiStore } from "@/store/uiStore";

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "markdown", label: "Markdown (.md)" },
  { value: "docx", label: "Word Document (.docx)" },
  { value: "pdf", label: "PDF (.pdf)" },
];

const SCOPE_OPTIONS: { value: ExportScope; label: string }[] = [
  { value: "chapter", label: "Current Chapter" },
  { value: "book", label: "Entire Book" },
];

export function ExportDialog() {
  const activeModal = useUiStore((s) => s.activeModal);
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);

  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [scope, setScope] = useState<ExportScope>(
    (modalData.scope as ExportScope) ?? "book",
  );
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeChapterHeadings, setIncludeChapterHeadings] = useState(true);
  const [pageBreaks, setPageBreaks] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (activeModal !== "export") return null;

  const projectId = modalData.projectId as string | undefined;
  const chapterId = modalData.chapterId as string | undefined;

  if (!projectId) return null;

  const resolvedProjectId = projectId;
  const hasChapter = !!chapterId;
  const effectiveScope = hasChapter ? scope : "book";

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await performExport({
        format,
        scope: effectiveScope,
        projectId: resolvedProjectId,
        chapterId: effectiveScope === "chapter" ? chapterId : undefined,
        includeTitlePage,
        includeChapterHeadings,
        pageBreaksBetweenChapters: pageBreaks,
      });
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const radioClass =
    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors";
  const radioActiveClass =
    "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
  const radioInactiveClass =
    "border-zinc-200 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <button
          type="button"
          onClick={closeModal}
          className="absolute right-4 top-4 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>

        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <Download size={18} />
          Export
        </h2>

        <div className="mt-5 space-y-5">
          {/* Format */}
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Format
            </legend>
            <div className="mt-2 flex gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value)}
                  className={`${radioClass} ${format === opt.value ? radioActiveClass : radioInactiveClass}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Scope */}
          {hasChapter && (
            <fieldset>
              <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Scope
              </legend>
              <div className="mt-2 flex gap-2">
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setScope(opt.value)}
                    className={`${radioClass} ${scope === opt.value ? radioActiveClass : radioInactiveClass}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Options */}
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Options
            </legend>
            <div className="mt-2 space-y-2">
              {effectiveScope === "book" && (
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeTitlePage}
                    onChange={(e) => setIncludeTitlePage(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                  />
                  Include title page
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={includeChapterHeadings}
                  onChange={(e) => setIncludeChapterHeadings(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                Include chapter headings
              </label>
              {format !== "markdown" && effectiveScope === "book" && (
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={pageBreaks}
                    onChange={(e) => setPageBreaks(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                  />
                  Page breaks between chapters
                </label>
              )}
            </div>
          </fieldset>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {exporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={14} />
                  Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
