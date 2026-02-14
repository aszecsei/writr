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
import { getTerm } from "@/lib/terminology";
import { useProjectStore } from "@/store/projectStore";
import { isExportModal, useUiStore } from "@/store/uiStore";

const PROSE_FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "markdown", label: "Markdown (.md)" },
  { value: "docx", label: "Word Document (.docx)" },
  { value: "pdf", label: "PDF (.pdf)" },
];

const SCREENPLAY_FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "fountain", label: "Fountain (.fountain)" },
  { value: "pdf", label: "PDF (.pdf)" },
];

export function ExportDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const activeProjectMode = useProjectStore((s) => s.activeProjectMode);
  const isScreenplay = activeProjectMode === "screenplay";

  const [format, setFormat] = useState<ExportFormat>(
    isScreenplay ? "fountain" : "markdown",
  );
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
        projectMode: activeProjectMode ?? "prose",
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
      <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        <Download size={18} />
        Export
      </h2>

      <div className="mt-5 space-y-5">
        {/* Format */}
        <fieldset>
          <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Format
          </legend>
          <div className="mt-2 flex gap-2">
            {(isScreenplay
              ? SCREENPLAY_FORMAT_OPTIONS
              : PROSE_FORMAT_OPTIONS
            ).map((opt) => (
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
            <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Scope
            </legend>
            <div className="mt-2 flex gap-2">
              {(
                [
                  {
                    value: "chapter" as ExportScope,
                    label: getTerm(activeProjectMode, "currentChapter"),
                  },
                  {
                    value: "book" as ExportScope,
                    label: getTerm(activeProjectMode, "entireBook"),
                  },
                ] as const
              ).map((opt) => (
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

        {/* Options (prose only — screenplay PDF uses standard formatting) */}
        {!isScreenplay && (
          <fieldset>
            <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Options
            </legend>
            <div className="mt-2 space-y-2">
              {effectiveScope === "book" && (
                <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={includeTitlePage}
                    onChange={(e) => setIncludeTitlePage(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                  />
                  Include title page
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={includeChapterHeadings}
                  onChange={(e) => setIncludeChapterHeadings(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                />
                Include {getTerm(activeProjectMode, "chapter").toLowerCase()}{" "}
                headings
              </label>
              {format !== "markdown" && effectiveScope === "book" && (
                <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={pageBreaks}
                    onChange={(e) => setPageBreaks(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
                  />
                  Page breaks between{" "}
                  {getTerm(activeProjectMode, "chapters").toLowerCase()}
                </label>
              )}
            </div>
          </fieldset>
        )}

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
