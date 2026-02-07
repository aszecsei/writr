import { APP_DICTIONARY_ID } from "@/lib/constants";
import { generateId } from "@/lib/id";
import { db } from "../database";
import {
  type AppDictionary,
  AppDictionarySchema,
  type ProjectDictionary,
  ProjectDictionarySchema,
} from "../schemas";
import { now } from "./helpers";

// ─── Shared helper ──────────────────────────────────────────────────

async function modifyDictionaryWords(
  getDict: () => Promise<{ words: string[] } | undefined>,
  updateFn: (data: { words: string[]; updatedAt: string }) => Promise<unknown>,
  word: string,
  action: "add" | "remove",
): Promise<void> {
  const normalized = word.toLowerCase().trim();
  if (!normalized) return;

  const dict = await getDict();
  if (!dict) return;

  const wordSet = new Set(dict.words);
  if (action === "add") {
    if (wordSet.has(normalized)) return;
    wordSet.add(normalized);
  } else {
    if (!wordSet.has(normalized)) return;
    wordSet.delete(normalized);
  }

  await updateFn({
    words: Array.from(wordSet).sort(),
    updatedAt: now(),
  });
}

// ─── App Dictionary ─────────────────────────────────────────────────

export async function getAppDictionary(): Promise<AppDictionary> {
  const existing = await db.appDictionary.get(APP_DICTIONARY_ID);
  if (existing) return AppDictionarySchema.parse(existing);
  const defaults = AppDictionarySchema.parse({
    id: APP_DICTIONARY_ID,
    words: [],
    updatedAt: now(),
  });
  await db.appDictionary.add(defaults);
  return defaults;
}

export async function addWordToAppDictionary(word: string): Promise<void> {
  return modifyDictionaryWords(
    getAppDictionary,
    (data) => db.appDictionary.update(APP_DICTIONARY_ID, data),
    word,
    "add",
  );
}

export async function removeWordFromAppDictionary(word: string): Promise<void> {
  return modifyDictionaryWords(
    getAppDictionary,
    (data) => db.appDictionary.update(APP_DICTIONARY_ID, data),
    word,
    "remove",
  );
}

// ─── Project Dictionary ─────────────────────────────────────────────

export async function getProjectDictionary(
  projectId: string,
): Promise<ProjectDictionary | undefined> {
  return db.projectDictionaries.where({ projectId }).first();
}

export async function getOrCreateProjectDictionary(
  projectId: string,
): Promise<ProjectDictionary> {
  const existing = await getProjectDictionary(projectId);
  if (existing) return ProjectDictionarySchema.parse(existing);

  const timestamp = now();
  const dict = ProjectDictionarySchema.parse({
    id: generateId(),
    projectId,
    words: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.projectDictionaries.add(dict);
  return dict;
}

export async function addWordToProjectDictionary(
  projectId: string,
  word: string,
): Promise<void> {
  const dict = await getOrCreateProjectDictionary(projectId);
  return modifyDictionaryWords(
    () => Promise.resolve(dict),
    (data) => db.projectDictionaries.update(dict.id, data),
    word,
    "add",
  );
}

export async function removeWordFromProjectDictionary(
  projectId: string,
  word: string,
): Promise<void> {
  const dict = await getProjectDictionary(projectId);
  if (!dict) return;
  return modifyDictionaryWords(
    () => Promise.resolve(dict),
    (data) => db.projectDictionaries.update(dict.id, data),
    word,
    "remove",
  );
}
