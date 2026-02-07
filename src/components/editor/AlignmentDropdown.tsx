"use client";

import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const alignments = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
  { value: "justify", label: "Justify", icon: AlignJustify },
] as const;

type Alignment = (typeof alignments)[number]["value"];

interface AlignmentDropdownProps {
  editor: Editor;
}

export function AlignmentDropdown({ editor }: AlignmentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentAlignment =
    alignments.find((a) => editor.isActive({ textAlign: a.value }))?.value ??
    "left";

  const CurrentIcon =
    alignments.find((a) => a.value === currentAlignment)?.icon ?? AlignLeft;

  const handleSelect = useCallback(
    (alignment: Alignment) => {
      editor.chain().focus().setTextAlign(alignment).run();
      setIsOpen(false);
    },
    [editor],
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        title="Text alignment"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-0.5 rounded p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <CurrentIcon size={16} />
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          {alignments.map((alignment) => {
            const Icon = alignment.icon;
            const isActive = currentAlignment === alignment.value;
            return (
              <button
                key={alignment.value}
                type="button"
                onClick={() => handleSelect(alignment.value)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                    : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-700"
                }`}
              >
                <Icon size={14} />
                {alignment.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
