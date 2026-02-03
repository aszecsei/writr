"use client";

import { useSortable } from "@dnd-kit/react/sortable";
import { BookOpen, MapPin, User } from "lucide-react";
import type { OutlineCard as OutlineCardType } from "@/db/schemas";

const COLOR_MAP: Record<string, string> = {
  yellow: "bg-amber-100 dark:bg-amber-900/40",
  pink: "bg-pink-100 dark:bg-pink-900/40",
  blue: "bg-sky-100 dark:bg-sky-900/40",
  green: "bg-emerald-100 dark:bg-emerald-900/40",
  orange: "bg-orange-100 dark:bg-orange-900/40",
  purple: "bg-violet-100 dark:bg-violet-900/40",
  white: "bg-white dark:bg-zinc-800",
};

interface OutlineCardProps {
  card: OutlineCardType;
  index: number;
  columnId: string;
  onClick: () => void;
}

export function OutlineCard({
  card,
  index,
  columnId,
  onClick,
}: OutlineCardProps) {
  const { ref, isDragSource } = useSortable({
    id: card.id,
    index,
    group: columnId,
    type: "card",
  });

  const bgClass = COLOR_MAP[card.color] ?? COLOR_MAP.yellow;
  const hasChapters = card.linkedChapterIds.length > 0;
  const hasCharacters = card.linkedCharacterIds.length > 0;
  const hasLocations = card.linkedLocationIds.length > 0;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-lg border border-zinc-200 p-3 text-left shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 ${bgClass} ${
        isDragSource ? "opacity-50 ring-2 ring-zinc-400" : ""
      }`}
    >
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {card.title}
      </p>
      {card.content && (
        <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
          {card.content}
        </p>
      )}
      {(hasChapters || hasCharacters || hasLocations) && (
        <div className="mt-2 flex gap-2">
          {hasChapters && (
            <span className="flex items-center gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              <BookOpen size={10} />
              {card.linkedChapterIds.length}
            </span>
          )}
          {hasCharacters && (
            <span className="flex items-center gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              <User size={10} />
              {card.linkedCharacterIds.length}
            </span>
          )}
          {hasLocations && (
            <span className="flex items-center gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              <MapPin size={10} />
              {card.linkedLocationIds.length}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
