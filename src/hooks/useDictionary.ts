import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import type { AppDictionary, ProjectDictionary } from "@/db/schemas";
import { APP_DICTIONARY_ID } from "@/lib/constants";

/**
 * Hook to get the app-level dictionary with live updates.
 */
export function useAppDictionary(): AppDictionary | undefined {
  return useLiveQuery(() => db.appDictionary.get(APP_DICTIONARY_ID), []);
}

/**
 * Hook to get a project-level dictionary with live updates.
 */
export function useProjectDictionary(
  projectId: string | undefined,
): ProjectDictionary | undefined {
  return useLiveQuery(
    () =>
      projectId
        ? db.projectDictionaries.where({ projectId }).first()
        : undefined,
    [projectId],
  );
}

/**
 * Hook to get combined dictionary words (app + project) as a Set.
 */
export function useCombinedDictionaryWords(
  projectId: string | undefined,
): Set<string> {
  const appDict = useAppDictionary();
  const projectDict = useProjectDictionary(projectId);

  const combined = new Set<string>();

  if (appDict?.words) {
    for (const word of appDict.words) {
      combined.add(word.toLowerCase());
    }
  }

  if (projectDict?.words) {
    for (const word of projectDict.words) {
      combined.add(word.toLowerCase());
    }
  }

  return combined;
}
