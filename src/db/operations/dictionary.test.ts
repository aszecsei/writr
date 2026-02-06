import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../database";
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

    it("should return existing app dictionary", async () => {
      await db.appDictionary.add({
        id: "app-dictionary",
        words: ["existing"],
        updatedAt: new Date().toISOString(),
      });

      const dict = await getAppDictionary();
      expect(dict.words).toEqual(["existing"]);
    });

    it("should add word to app dictionary", async () => {
      await addWordToAppDictionary("hello");
      const dict = await getAppDictionary();
      expect(dict.words).toContain("hello");
    });

    it("should normalize word to lowercase", async () => {
      await addWordToAppDictionary("UPPERCASE");
      const dict = await getAppDictionary();
      expect(dict.words).toContain("uppercase");
      expect(dict.words).not.toContain("UPPERCASE");
    });

    it("should trim whitespace from word", async () => {
      await addWordToAppDictionary("  spaced  ");
      const dict = await getAppDictionary();
      expect(dict.words).toContain("spaced");
    });

    it("should not add duplicate words", async () => {
      await addWordToAppDictionary("duplicate");
      await addWordToAppDictionary("duplicate");
      await addWordToAppDictionary("DUPLICATE");
      const dict = await getAppDictionary();
      const count = dict.words.filter((w) => w === "duplicate").length;
      expect(count).toBe(1);
    });

    it("should not add empty words", async () => {
      await addWordToAppDictionary("");
      await addWordToAppDictionary("   ");
      const dict = await getAppDictionary();
      expect(dict.words).toEqual([]);
    });

    it("should keep words sorted", async () => {
      await addWordToAppDictionary("zebra");
      await addWordToAppDictionary("apple");
      await addWordToAppDictionary("mango");
      const dict = await getAppDictionary();
      expect(dict.words).toEqual(["apple", "mango", "zebra"]);
    });

    it("should remove word from app dictionary", async () => {
      await addWordToAppDictionary("toremove");
      await removeWordFromAppDictionary("toremove");
      const dict = await getAppDictionary();
      expect(dict.words).not.toContain("toremove");
    });

    it("should handle removing non-existent word gracefully", async () => {
      await removeWordFromAppDictionary("nonexistent");
      const dict = await getAppDictionary();
      expect(dict.words).toEqual([]);
    });
  });

  describe("project dictionary", () => {
    // Valid UUIDv4 format: 8-4-4-4-12 with version 4 at position 15 and variant at position 20
    const projectId = "a1111111-1111-4111-a111-111111111111";

    it("should return undefined for non-existent project dictionary", async () => {
      const dict = await getProjectDictionary(projectId);
      expect(dict).toBeUndefined();
    });

    it("should create project dictionary if none exists", async () => {
      const dict = await getOrCreateProjectDictionary(projectId);
      expect(dict.projectId).toBe(projectId);
      expect(dict.words).toEqual([]);
    });

    it("should return existing project dictionary", async () => {
      await getOrCreateProjectDictionary(projectId);
      await addWordToProjectDictionary(projectId, "existing");

      const dict = await getProjectDictionary(projectId);
      expect(dict?.words).toContain("existing");
    });

    it("should add word to project dictionary", async () => {
      await addWordToProjectDictionary(projectId, "hello");
      const dict = await getProjectDictionary(projectId);
      expect(dict?.words).toContain("hello");
    });

    it("should normalize word to lowercase", async () => {
      await addWordToProjectDictionary(projectId, "UPPERCASE");
      const dict = await getProjectDictionary(projectId);
      expect(dict?.words).toContain("uppercase");
    });

    it("should not add duplicate words", async () => {
      await addWordToProjectDictionary(projectId, "duplicate");
      await addWordToProjectDictionary(projectId, "duplicate");
      const dict = await getProjectDictionary(projectId);
      const count = dict?.words.filter((w) => w === "duplicate").length;
      expect(count).toBe(1);
    });

    it("should keep words sorted", async () => {
      await addWordToProjectDictionary(projectId, "zebra");
      await addWordToProjectDictionary(projectId, "apple");
      await addWordToProjectDictionary(projectId, "mango");
      const dict = await getProjectDictionary(projectId);
      expect(dict?.words).toEqual(["apple", "mango", "zebra"]);
    });

    it("should remove word from project dictionary", async () => {
      await addWordToProjectDictionary(projectId, "toremove");
      await removeWordFromProjectDictionary(projectId, "toremove");
      const dict = await getProjectDictionary(projectId);
      expect(dict?.words).not.toContain("toremove");
    });

    it("should handle removing from non-existent dictionary gracefully", async () => {
      await removeWordFromProjectDictionary(projectId, "nonexistent");
      const dict = await getProjectDictionary(projectId);
      expect(dict).toBeUndefined();
    });

    it("should maintain separate dictionaries per project", async () => {
      const projectId2 = "b2222222-2222-4222-a222-222222222222";

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
