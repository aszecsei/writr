"use client";

import { Check, Copy, FileCode2, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        copyMenuRef.current &&
        !copyMenuRef.current.contains(event.target as Node)
      ) {
        setCopyMenuOpen(false);
      }
    }
    if (copyMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [copyMenuOpen]);

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
        className={`rounded p-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
          copiedType
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        {copiedType ? <Check size={16} /> : <Copy size={16} />}
      </button>
      {copyMenuOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <FileText size={14} />
            Copy Markdown
          </button>
          <button
            type="button"
            onClick={handleCopyAo3Html}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <FileCode2 size={14} />
            Copy AO3 HTML
          </button>
        </div>
      )}
    </div>
  );
}
