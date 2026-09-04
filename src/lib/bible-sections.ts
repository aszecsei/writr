import type { LucideIcon } from "lucide-react";
import { Clock, GitFork, Globe, MapPin, Music, Pen, Users } from "lucide-react";

export interface BibleSection {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Singular/plural noun for the overview page's count subtitle. */
  noun: { singular: string; plural: string };
}

export const BIBLE_SECTIONS: BibleSection[] = [
  {
    key: "characters",
    label: "Characters",
    path: "bible/characters",
    icon: Users,
    noun: { singular: "entry", plural: "entries" },
  },
  {
    key: "locations",
    label: "Locations",
    path: "bible/locations",
    icon: MapPin,
    noun: { singular: "entry", plural: "entries" },
  },
  {
    key: "timeline",
    label: "Timeline",
    path: "bible/timeline",
    icon: Clock,
    noun: { singular: "entry", plural: "entries" },
  },
  {
    key: "family-tree",
    label: "Family Tree",
    path: "bible/family-tree",
    icon: GitFork,
    noun: { singular: "relationship", plural: "relationships" },
  },
  {
    key: "style-guide",
    label: "Style Guide",
    path: "bible/style-guide",
    icon: Pen,
    noun: { singular: "entry", plural: "entries" },
  },
  {
    key: "worldbuilding",
    label: "Worldbuilding",
    path: "bible/worldbuilding",
    icon: Globe,
    noun: { singular: "entry", plural: "entries" },
  },
  {
    key: "playlist",
    label: "Playlist",
    path: "bible/playlist",
    icon: Music,
    noun: { singular: "track", plural: "tracks" },
  },
];
