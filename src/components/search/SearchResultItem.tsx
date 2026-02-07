"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { splitByMatch } from "@/lib/search";

interface SearchResultItemProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  snippet: string;
  matchField: string;
  url: string;
  query: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export function SearchResultItem({
  icon: Icon,
  title,
  subtitle,
  snippet,
  matchField,
  url,
  query,
  isSelected,
  onClick,
}: SearchResultItemProps) {
  const parts = splitByMatch(snippet, query);

  return (
    <Link
      href={url}
      onClick={onClick}
      className={`block rounded-md px-3 py-2 transition-colors ${
        isSelected
          ? "bg-neutral-100 dark:bg-neutral-800"
          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
      }`}
    >
      <div className="flex items-start gap-2">
        <Icon
          size={14}
          className="mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {title}
            </span>
            {subtitle && (
              <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                {subtitle}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
            {parts.map((part, i) => {
              const key = `${i}-${part.isMatch ? "m" : "t"}`;
              return part.isMatch ? (
                <mark
                  key={key}
                  className="bg-yellow-200 text-neutral-900 dark:bg-yellow-500/30 dark:text-neutral-100"
                >
                  {part.text}
                </mark>
              ) : (
                <span key={key}>{part.text}</span>
              );
            })}
          </p>
          <span className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            in {matchField}
          </span>
        </div>
      </div>
    </Link>
  );
}
