"use client";

import { Minus, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";

interface AccordionSectionProps {
  /** Section heading, rendered uppercase. */
  title: string;
  /** One-line plain-language blurb shown above the content when expanded. */
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Flat collapsible section with an uppercase header and a +/− toggle, used to
 * stack metric groups in narrow panels. Distinct from `bible/CollapsibleSection`,
 * which is a card-style container with an icon header.
 */
export function AccordionSection({
  title,
  description,
  defaultOpen = true,
  children,
}: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-700 dark:text-neutral-300">
          {title}
        </span>
        {isOpen ? (
          <Minus size={14} className="text-neutral-400 dark:text-neutral-500" />
        ) : (
          <Plus size={14} className="text-neutral-400 dark:text-neutral-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-3 pb-3">
          {description && (
            <p className="mb-2 text-[11px] text-neutral-400 dark:text-neutral-500">
              {description}
            </p>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
