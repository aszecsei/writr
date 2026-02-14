"use client";

import { Check, Copy, FileCode2, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  copyChapterAo3HtmlToClipboard,
  copyChapterMarkdownToClipboard,
} from "@/lib/export";

type CopiedType = "markdown" | "ao3" | null;

interface CopyMenuProps {
  projectId: string;
  chapterId: string;
}

export function CopyMenu({ projectId, chapterId }: CopyMenuProps) {
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<CopiedType>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(copyMenuRef, () => setCopyMenuOpen(false), copyMenuOpen);

  async function handleCopyMarkdown() {
    try {
      await copyChapterMarkdownToClipboard({
        projectId,
        chapterId,
        includeChapterHeading: false,
      });
      setCopiedType("markdown");
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // Silently fail
    }
    setCopyMenuOpen(false);
  }

  async function handleCopyAo3Html() {
    try {
      await copyChapterAo3HtmlToClipboard({
        projectId,
        chapterId,
        includeChapterHeading: false,
      });
      setCopiedType("ao3");
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // Silently fail
    }
    setCopyMenuOpen(false);
  }

  return (
    <div className="relative" ref={copyMenuRef}>
      <button
        type="button"
        title="Copy to clipboard"
        onClick={() => setCopyMenuOpen(!copyMenuOpen)}
        className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
          copiedType
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        }`}
      >
        {copiedType ? <Check size={16} /> : <Copy size={16} />}
      </button>
      {copyMenuOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            <FileText size={14} />
            Copy Markdown
          </button>
          <button
            type="button"
            onClick={handleCopyAo3Html}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            <FileCode2 size={14} />
            Copy AO3 HTML
          </button>
        </div>
      )}
    </div>
  );
}
