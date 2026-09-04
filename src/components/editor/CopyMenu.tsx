"use client";

import { Check, Copy, FileCode2, FileText } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { ToolbarButton } from "@/components/ui/ToolbarButton";
import type { ChapterId, ProjectId } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { useChapter } from "@/hooks/data/useChapter";
import {
  copyChapterAo3HtmlToClipboard,
  copyChapterMarkdownToClipboard,
} from "@/lib/export";
import { countHoles, DEFAULT_HOLE_DELIMITERS } from "@/lib/holes";

type CopyType = "markdown" | "ao3";

interface CopyMenuProps {
  projectId: ProjectId;
  chapterId: ChapterId;
}

export function CopyMenu({ projectId, chapterId }: CopyMenuProps) {
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<CopyType | null>(null);
  // When the chapter contains holes, the requested copy is held here pending
  // confirmation rather than running immediately.
  const [pendingCopy, setPendingCopy] = useState<CopyType | null>(null);

  const chapter = useChapter(chapterId);
  const settings = useAppSettings();
  const holeDelimiters = settings?.holeDelimiters ?? DEFAULT_HOLE_DELIMITERS;

  async function runCopy(type: CopyType) {
    try {
      if (type === "markdown") {
        await copyChapterMarkdownToClipboard({
          projectId,
          chapterId,
          includeChapterHeading: false,
        });
      } else {
        await copyChapterAo3HtmlToClipboard({
          projectId,
          chapterId,
          includeChapterHeading: false,
        });
      }
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // Silently fail
    }
  }

  function requestCopy(type: CopyType) {
    setCopyMenuOpen(false);
    if (countHoles(chapter?.content ?? "", holeDelimiters) > 0) {
      setPendingCopy(type);
      return;
    }
    void runCopy(type);
  }

  const pendingHoleCount = pendingCopy
    ? countHoles(chapter?.content ?? "", holeDelimiters)
    : 0;

  return (
    <>
      <DropdownMenu
        open={copyMenuOpen}
        onClose={() => setCopyMenuOpen(false)}
        panelClassName="w-44 rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
        trigger={
          <ToolbarButton
            icon={copiedType ? Check : Copy}
            title="Copy to clipboard"
            onClick={() => setCopyMenuOpen(!copyMenuOpen)}
            variant={copiedType ? "success" : "default"}
          />
        }
      >
        <DropdownMenuItem
          icon={FileText}
          onClick={() => requestCopy("markdown")}
        >
          Copy Markdown
        </DropdownMenuItem>
        <DropdownMenuItem icon={FileCode2} onClick={() => requestCopy("ao3")}>
          Copy AO3 HTML
        </DropdownMenuItem>
      </DropdownMenu>
      {pendingCopy && (
        <ConfirmDialog
          title="Copy material with holes?"
          message={`This ${
            pendingCopy === "markdown" ? "markdown" : "AO3 HTML"
          } contains ${pendingHoleCount} ${
            pendingHoleCount === 1 ? "hole" : "holes"
          } — placeholder sections you haven't filled in yet.`}
          confirmLabel="Copy anyway"
          onConfirm={() => {
            const type = pendingCopy;
            setPendingCopy(null);
            void runCopy(type);
          }}
          onCancel={() => setPendingCopy(null)}
        />
      )}
    </>
  );
}
