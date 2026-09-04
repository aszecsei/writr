"use client";

import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
} from "lucide-react";
import { useCallback, useState } from "react";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";

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

  return (
    <DropdownMenu
      open={isOpen}
      onClose={() => setIsOpen(false)}
      panelClassName="rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
      trigger={
        <button
          type="button"
          title="Text alignment"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-0.5 rounded p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <CurrentIcon size={16} />
          <ChevronDown size={12} />
        </button>
      }
    >
      {alignments.map((alignment) => (
        <DropdownMenuItem
          key={alignment.value}
          icon={alignment.icon}
          active={currentAlignment === alignment.value}
          onClick={() => handleSelect(alignment.value)}
        >
          {alignment.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenu>
  );
}
