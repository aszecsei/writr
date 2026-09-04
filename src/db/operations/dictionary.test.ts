import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
import type { ProjectId } from "../schemas";
import {
  addWordToAppDictionary,
  addWordToProjectDictionary,
  getAppDictionary,
  getOrCreateProjectDictionary,
  getProjectDictionary,
  removeWordFromAppDictionary,
  removeWordFromProjectDictionary,
} from "./dictionary";

describe("dictionary operations", () => {
  beforeEach(async () => {
    await db.appDictionary.clear();
    await db.projectDictionaries.clear();
  });

  describe("app dictionary", () => {
    it("should create default app dictionary if none exists", async () => {
      const dict = await getAppDictionary();
      expect(dict.id).toBe("app-dictionary");
      expect(dict.words).toEqual([]);
    });

    it("round-trips a word: add then remove", async () => {
      await addWordToAppDictionary("hello");
      expect((await getAppDictionary()).words).toContain("hello");

      await removeWordFromAppDictionary("hello");
      expect((await getAppDictionary()).words).not.toContain("hello");
    });

    // The shared modifyDictionaryWords helper does the normalizing, deduping,
    // and sorting for both app and project dictionaries — exercised fully
    // once here, then smoke-tested for the project variant below.
    it("normalizes, dedupes, drops empties, and sorts words", async () => {
      await addWordToAppDictionary("  Zebra  ");
      await addWordToAppDictionary("APPLE");
      await addWordToAppDictionary("apple");
      await addWordToAppDictionary("");
      await addWordToAppDictionary("   ");

      const dict = await getAppDictionary();
      expect(dict.words).toEqual(["apple", "zebra"]);
    });
  });

  describe("project dictionary", () => {
    const projectId = "a1111111-1111-4111-a111-111111111111" as ProjectId;

    it("should create project dictionary if none exists", async () => {
      const dict = await getOrCreateProjectDictionary(projectId);
      expect(dict.projectId).toBe(projectId);
      expect(dict.words).toEqual([]);
    });

    it("round-trips a word for a project dictionary", async () => {
      await addWordToProjectDictionary(projectId, "UPPERCASE");
      expect((await getProjectDictionary(projectId))?.words).toContain(
        "uppercase",
      );

      await removeWordFromProjectDictionary(projectId, "uppercase");
      expect((await getProjectDictionary(projectId))?.words).not.toContain(
        "uppercase",
      );
    });

    it("maintains separate dictionaries per project", async () => {
      const projectId2 = "b2222222-2222-4222-a222-222222222222" as ProjectId;

      await addWordToProjectDictionary(projectId, "project1word");
      await addWordToProjectDictionary(projectId2, "project2word");

      const dict1 = await getProjectDictionary(projectId);
      const dict2 = await getProjectDictionary(projectId2);

      expect(dict1?.words).toContain("project1word");
      expect(dict1?.words).not.toContain("project2word");
      expect(dict2?.words).toContain("project2word");
      expect(dict2?.words).not.toContain("project1word");
    });
  });
});
