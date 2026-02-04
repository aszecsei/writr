import { Clock, FileText, Globe, MapPin, Pen, Users } from "lucide-react";
import type { EntityGroupConfig, SearchableEntityType } from "./types";

export const entityConfigs: Record<SearchableEntityType, EntityGroupConfig> = {
  chapter: {
    type: "chapter",
    label: "Chapter",
    labelPlural: "Chapters",
    icon: FileText,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/chapters/${entityId}`,
    searchableFields: ["title", "content", "synopsis"],
  },
  character: {
    type: "character",
    label: "Character",
    labelPlural: "Characters",
    icon: Users,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/characters/${entityId}`,
    searchableFields: [
      "name",
      "aliases",
      "description",
      "personality",
      "motivations",
      "backstory",
      "notes",
    ],
  },
  location: {
    type: "location",
    label: "Location",
    labelPlural: "Locations",
    icon: MapPin,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/locations/${entityId}`,
    searchableFields: ["name", "description", "notes"],
  },
  timelineEvent: {
    type: "timelineEvent",
    label: "Timeline Event",
    labelPlural: "Timeline Events",
    icon: Clock,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/timeline?highlight=${entityId}`,
    searchableFields: ["title", "description"],
  },
  styleGuideEntry: {
    type: "styleGuideEntry",
    label: "Style Guide",
    labelPlural: "Style Guide Entries",
    icon: Pen,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/style-guide?highlight=${entityId}`,
    searchableFields: ["title", "content"],
  },
  worldbuildingDoc: {
    type: "worldbuildingDoc",
    label: "Worldbuilding",
    labelPlural: "Worldbuilding Docs",
    icon: Globe,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/worldbuilding?doc=${entityId}`,
    searchableFields: ["title", "tags", "content"],
  },
};

export const entityTypeOrder: SearchableEntityType[] = [
  "chapter",
  "character",
  "location",
  "timelineEvent",
  "styleGuideEntry",
  "worldbuildingDoc",
];
