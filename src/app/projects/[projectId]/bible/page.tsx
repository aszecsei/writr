"use client";

import type { LucideIcon } from "lucide-react";
import { Clock, GitFork, Globe, MapPin, Music, Pen, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCharactersByProject,
  useLocationsByProject,
  useRelationshipsByProject,
  useStyleGuideByProject,
  useTimelineByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/useBibleEntries";
import { usePlaylistByProject } from "@/hooks/usePlaylistEntries";

const sections: {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
}[] = [
  {
    key: "characters",
    label: "Characters",
    path: "bible/characters",
    icon: Users,
  },
  {
    key: "locations",
    label: "Locations",
    path: "bible/locations",
    icon: MapPin,
  },
  { key: "timeline", label: "Timeline", path: "bible/timeline", icon: Clock },
  {
    key: "family-tree",
    label: "Family Tree",
    path: "bible/family-tree",
    icon: GitFork,
  },
  {
    key: "style-guide",
    label: "Style Guide",
    path: "bible/style-guide",
    icon: Pen,
  },
  {
    key: "worldbuilding",
    label: "Worldbuilding",
    path: "bible/worldbuilding",
    icon: Globe,
  },
  {
    key: "playlist",
    label: "Playlist",
    path: "bible/playlist",
    icon: Music,
  },
];

export default function BibleOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const characters = useCharactersByProject(params.projectId);
  const locations = useLocationsByProject(params.projectId);
  const timeline = useTimelineByProject(params.projectId);
  const relationships = useRelationshipsByProject(params.projectId);
  const styleGuide = useStyleGuideByProject(params.projectId);
  const worldbuilding = useWorldbuildingDocsByProject(params.projectId);
  const playlist = usePlaylistByProject(params.projectId);

  const counts: Record<string, number | undefined> = {
    characters: characters?.length,
    locations: locations?.length,
    timeline: timeline?.length,
    "family-tree": relationships?.length,
    "style-guide": styleGuide?.length,
    worldbuilding: worldbuilding?.length,
    playlist: playlist?.length,
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Story Bible
      </h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Track characters, locations, events, relationships, style rules, and
        worldbuilding details.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.key}
              href={`/projects/${params.projectId}/${section.path}`}
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <Icon size={16} />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300">
                {section.label}
              </h3>
              <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {counts[section.key] ?? 0}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                {section.key === "family-tree"
                  ? counts[section.key] === 1
                    ? "relationship"
                    : "relationships"
                  : section.key === "playlist"
                    ? counts[section.key] === 1
                      ? "track"
                      : "tracks"
                    : counts[section.key] === 1
                      ? "entry"
                      : "entries"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
