export * from "./entity-config";
export * from "./highlight";
export * from "./types";

import type { GroupedSearchResults } from "./types";

export function getTotalResultCount(grouped: GroupedSearchResults[]): number {
  return grouped.reduce((sum, group) => sum + group.results.length, 0);
}
