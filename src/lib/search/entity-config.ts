import {
  Clock,
  FileText,
  Globe,
  Grid3x3,
  MapPin,
  Pen,
  ShieldAlert,
  Users,
} from "lucide-react";
import { db } from "@/db/database";
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
    titleField: "title",
    loadEntities: (projectId) => db.chapters.where({ projectId }).toArray(),
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
    titleField: "name",
    subtitleField: "role",
    loadEntities: (projectId) => db.characters.where({ projectId }).toArray(),
  },
  location: {
    type: "location",
    label: "Location",
    labelPlural: "Locations",
    icon: MapPin,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/locations/${entityId}`,
    searchableFields: ["name", "description", "notes"],
    titleField: "name",
    loadEntities: (projectId) => db.locations.where({ projectId }).toArray(),
  },
  timelineEvent: {
    type: "timelineEvent",
    label: "Timeline Event",
    labelPlural: "Timeline Events",
    icon: Clock,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/timeline?highlight=${entityId}`,
    searchableFields: ["title", "description"],
    titleField: "title",
    loadEntities: (projectId) =>
      db.timelineEvents.where({ projectId }).toArray(),
  },
  styleGuideEntry: {
    type: "styleGuideEntry",
    label: "Style Guide",
    labelPlural: "Style Guide Entries",
    icon: Pen,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/style-guide?highlight=${entityId}`,
    searchableFields: ["title", "content"],
    titleField: "title",
    subtitleField: "category",
    loadEntities: (projectId) =>
      db.styleGuideEntries.where({ projectId }).toArray(),
  },
  guardrailEntry: {
    type: "guardrailEntry",
    label: "Guardrail",
    labelPlural: "Guardrails",
    icon: ShieldAlert,
    // Guardrails live alongside the style guide on the same page.
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/style-guide?highlight=${entityId}`,
    searchableFields: ["label", "fix", "positiveFix"],
    titleField: "label",
    loadEntities: (projectId) =>
      db.guardrailEntries.where({ projectId }).toArray(),
  },
  worldbuildingDoc: {
    type: "worldbuildingDoc",
    label: "Worldbuilding",
    labelPlural: "Worldbuilding Docs",
    icon: Globe,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/bible/worldbuilding?doc=${entityId}`,
    searchableFields: ["title", "tags", "content"],
    titleField: "title",
    loadEntities: (projectId) =>
      db.worldbuildingDocs.where({ projectId }).toArray(),
  },
  outlineCell: {
    type: "outlineCell",
    label: "Outline Cell",
    labelPlural: "Outline Cells",
    icon: Grid3x3,
    buildUrl: (projectId, entityId) =>
      `/projects/${projectId}/outline?highlight=${entityId}`,
    searchableFields: ["content"],
    // No titleField/loadEntities: an outline cell's display title is
    // composed from its row + column, which needs a join — see
    // loadOutlineCellDocs in build-index.ts.
  },
};

export const entityTypeOrder: SearchableEntityType[] = [
  "chapter",
  "character",
  "location",
  "timelineEvent",
  "styleGuideEntry",
  "guardrailEntry",
  "worldbuildingDoc",
  "outlineCell",
];
