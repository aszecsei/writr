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
  const normalized = word.toLowerCase().trim();
  if (!normalized) return;

  const dict = await getAppDictionary();
  const wordSet = new Set(dict.words);
  if (wordSet.has(normalized)) return;

  wordSet.add(normalized);
  await db.appDictionary.update(APP_DICTIONARY_ID, {
    words: Array.from(wordSet).sort(),
    updatedAt: now(),
  });
}

export async function removeWordFromAppDictionary(word: string): Promise<void> {
  const normalized = word.toLowerCase().trim();
  if (!normalized) return;

  const dict = await getAppDictionary();
  const wordSet = new Set(dict.words);
  if (!wordSet.has(normalized)) return;

  wordSet.delete(normalized);
  await db.appDictionary.update(APP_DICTIONARY_ID, {
    words: Array.from(wordSet).sort(),
    updatedAt: now(),
  });
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
  const normalized = word.toLowerCase().trim();
  if (!normalized) return;

  const dict = await getOrCreateProjectDictionary(projectId);
  const wordSet = new Set(dict.words);
  if (wordSet.has(normalized)) return;

  wordSet.add(normalized);
  await db.projectDictionaries.update(dict.id, {
    words: Array.from(wordSet).sort(),
    updatedAt: now(),
  });
}

export async function removeWordFromProjectDictionary(
  projectId: string,
  word: string,
): Promise<void> {
  const normalized = word.toLowerCase().trim();
  if (!normalized) return;

  const dict = await getProjectDictionary(projectId);
  if (!dict) return;

  const wordSet = new Set(dict.words);
  if (!wordSet.has(normalized)) return;

  wordSet.delete(normalized);
  await db.projectDictionaries.update(dict.id, {
    words: Array.from(wordSet).sort(),
    updatedAt: now(),
  });
}
