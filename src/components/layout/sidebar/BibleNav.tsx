"use client";

import type { LucideIcon } from "lucide-react";
import {
  Clock,
  GitFork,
  Globe,
  LayoutGrid,
  MapPin,
  Music,
  Pen,
  Users,
} from "lucide-react";
import Link from "next/link";

const bibleLinks: { label: string; path: string; icon: LucideIcon }[] = [
  { label: "Characters", path: "bible/characters", icon: Users },
  { label: "Locations", path: "bible/locations", icon: MapPin },
  { label: "Timeline", path: "bible/timeline", icon: Clock },
  { label: "Family Tree", path: "bible/family-tree", icon: GitFork },
  { label: "Style Guide", path: "bible/style-guide", icon: Pen },
  { label: "Worldbuilding", path: "bible/worldbuilding", icon: Globe },
  { label: "Playlist", path: "bible/playlist", icon: Music },
];

export function BibleNav({
  projectId,
  pathname,
}: {
  projectId: string;
  pathname: string;
}) {
  return (
    <div className="space-y-1">
      <Link
        href={`/projects/${projectId}/bible`}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          pathname === `/projects/${projectId}/bible`
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        }`}
      >
        <LayoutGrid size={14} />
        Overview
      </Link>
      {bibleLinks.map((link) => {
        const href = `/projects/${projectId}/${link.path}`;
        const isActive = pathname.startsWith(href);
        const Icon = link.icon;
        return (
          <Link
            key={link.path}
            href={href}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            <Icon size={14} />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
