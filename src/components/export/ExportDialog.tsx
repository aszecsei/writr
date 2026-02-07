"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import {
  RADIO_ACTIVE,
  RADIO_BASE,
  RADIO_INACTIVE,
} from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import {
  type ExportFormat,
  type ExportScope,
  performExport,
} from "@/lib/export";
import { isExportModal, useUiStore } from "@/store/uiStore";

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
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);

  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [scope, setScope] = useState<ExportScope>("book");
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeChapterHeadings, setIncludeChapterHeadings] = useState(true);
  const [pageBreaks, setPageBreaks] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isExportModal(modal)) return null;

  const { projectId, chapterId } = modal;
  const hasChapter = !!chapterId;
  const effectiveScope = hasChapter ? scope : "book";

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      await performExport({
        format,
        scope: effectiveScope,
        projectId,
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

  return (
    <Modal onClose={closeModal}>
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
                className={`${RADIO_BASE} ${format === opt.value ? RADIO_ACTIVE : RADIO_INACTIVE}`}
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
                  className={`${RADIO_BASE} ${scope === opt.value ? RADIO_ACTIVE : RADIO_INACTIVE}`}
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
        <DialogFooter
          onCancel={closeModal}
          submitDisabled={exporting}
          submitType="button"
          onSubmit={handleExport}
          submitClassName="flex items-center gap-2"
          submitChildren={
            exporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={14} />
                Export
              </>
            )
          }
        />
      </div>
    </Modal>
  );
}
