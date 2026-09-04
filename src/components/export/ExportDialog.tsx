"use client";

import { Download, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import {
  CHECKBOX_CLASS,
  LEGEND_CLASS,
  RADIO_ACTIVE,
  RADIO_BASE,
  RADIO_INACTIVE,
} from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import {
  type ExportFormat,
  type ExportHoleScan,
  type ExportScope,
  performExport,
  scanExportHoles,
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
  // Holds the pre-export hole scan once confirmed unsafe; a second submit while
  // this is set proceeds anyway. Reset whenever the export shape changes.
  const [holeWarning, setHoleWarning] = useState<ExportHoleScan | null>(null);

  if (!isExportModal(modal)) return null;

  const { projectId, chapterId } = modal;
  const hasChapter = !!chapterId;
  const effectiveScope = hasChapter ? scope : "book";

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const exportOptions = {
        format,
        scope: effectiveScope,
        projectId,
        chapterId: effectiveScope === "chapter" ? chapterId : undefined,
        includeTitlePage,
        includeChapterHeadings,
        pageBreaksBetweenChapters: pageBreaks,
        projectMode: activeProjectMode ?? "prose",
      } as const;

      // First submit: if the material contains holes and the user hasn't
      // acknowledged yet, surface a warning and stop. A second submit proceeds.
      if (!holeWarning) {
        const scan = await scanExportHoles(exportOptions);
        if (scan.total > 0) {
          setHoleWarning(scan);
          setExporting(false);
          return;
        }
      }

      await performExport(exportOptions);
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      onClose={closeModal}
      title={
        <span className="inline-flex items-center gap-2">
          <Download size={18} />
          Export
        </span>
      }
    >
      <div className="mt-5 space-y-5">
        {/* Format */}
        <fieldset>
          <legend className={LEGEND_CLASS}>Format</legend>
          <div className="mt-2 flex gap-2">
            {(isScreenplay
              ? SCREENPLAY_FORMAT_OPTIONS
              : PROSE_FORMAT_OPTIONS
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setFormat(opt.value);
                  setHoleWarning(null);
                }}
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
            <legend className={LEGEND_CLASS}>Scope</legend>
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
                  onClick={() => {
                    setScope(opt.value);
                    setHoleWarning(null);
                  }}
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
            <legend className={LEGEND_CLASS}>Options</legend>
            <div className="mt-2 space-y-2">
              {effectiveScope === "book" && (
                <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={includeTitlePage}
                    onChange={(e) => setIncludeTitlePage(e.target.checked)}
                    className={CHECKBOX_CLASS}
                  />
                  Include title page
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={includeChapterHeadings}
                  onChange={(e) => setIncludeChapterHeadings(e.target.checked)}
                  className={CHECKBOX_CLASS}
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
                    className={CHECKBOX_CLASS}
                  />
                  Page breaks between{" "}
                  {getTerm(activeProjectMode, "chapters").toLowerCase()}
                </label>
              )}
            </div>
          </fieldset>
        )}

        {/* Hole warning */}
        {holeWarning && (
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                This export contains {holeWarning.total}{" "}
                {holeWarning.total === 1 ? "hole" : "holes"}
                {holeWarning.chapters.length > 1
                  ? ` across ${holeWarning.chapters.length} chapters`
                  : ""}
                .
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-400/90">
                Holes are placeholder sections you haven't filled in yet. Export
                anyway?
              </p>
            </div>
          </div>
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
                {holeWarning ? "Export anyway" : "Export"}
              </>
            )
          }
        />
      </div>
    </Modal>
  );
}
