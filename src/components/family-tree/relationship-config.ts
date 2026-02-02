import type { RelationshipType } from "@/db/schemas";

export interface RelationshipTypeConfig {
  value: RelationshipType;
  label: string;
  badgeColor: string;
  edgeStroke: string;
  edgeDasharray?: string;
}

export const relationshipTypeConfigs: Record<
  RelationshipType,
  RelationshipTypeConfig
> = {
  parent: {
    value: "parent",
    label: "Parent",
    badgeColor:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    edgeStroke: "#10b981",
  },
  child: {
    value: "child",
    label: "Child",
    badgeColor:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    edgeStroke: "#10b981",
  },
  spouse: {
    value: "spouse",
    label: "Spouse",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
    edgeStroke: "#f43f5e",
  },
  divorced: {
    value: "divorced",
    label: "Divorced",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
    edgeStroke: "#f43f5e",
    edgeDasharray: "5 3",
  },
  sibling: {
    value: "sibling",
    label: "Sibling",
    badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
    edgeStroke: "#0ea5e9",
  },
  custom: {
    value: "custom",
    label: "Custom",
    badgeColor:
      "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    edgeStroke: "#8b5cf6",
    edgeDasharray: "5 3",
  },
};

export const relationshipTypeList: RelationshipTypeConfig[] = Object.values(
  relationshipTypeConfigs,
);
