"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCharactersByProject,
  useLocationsByProject,
  useStyleGuideByProject,
  useTimelineByProject,
  useWorldbuildingDocsByProject,
} from "@/hooks/useBibleEntries";

const sections = [
  { key: "characters", label: "Characters", path: "bible/characters" },
  { key: "locations", label: "Locations", path: "bible/locations" },
  { key: "timeline", label: "Timeline", path: "bible/timeline" },
  { key: "style-guide", label: "Style Guide", path: "bible/style-guide" },
  { key: "worldbuilding", label: "Worldbuilding", path: "bible/worldbuilding" },
] as const;

export default function BibleOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const characters = useCharactersByProject(params.projectId);
  const locations = useLocationsByProject(params.projectId);
  const timeline = useTimelineByProject(params.projectId);
  const styleGuide = useStyleGuideByProject(params.projectId);
  const worldbuilding = useWorldbuildingDocsByProject(params.projectId);

  const counts: Record<string, number | undefined> = {
    characters: characters?.length,
    locations: locations?.length,
    timeline: timeline?.length,
    "style-guide": styleGuide?.length,
    worldbuilding: worldbuilding?.length,
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Story Bible
      </h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Track characters, locations, events, style rules, and worldbuilding
        details.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.key}
            href={`/projects/${params.projectId}/${section.path}`}
            className="group rounded-lg border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300">
              {section.label}
            </h3>
            <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {counts[section.key] ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
              {counts[section.key] === 1 ? "entry" : "entries"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
