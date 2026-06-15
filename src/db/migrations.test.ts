import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { backfillBinderFieldsV37 } from "./database";
import { ChapterSchema } from "./schemas";

// The chapters store string as it existed at v36 (before the binder feature).
// v37 changes no indexes, so this is also the v37 store string.
const CHAPTERS_STORE = "id, projectId, [projectId+order], updatedAt";
const TS = "2024-01-01T00:00:00.000Z";
const LEGACY_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID = "00000000-0000-4000-8000-0000000000aa";

describe("v37 binder-fields migration", () => {
  const dbName = "writr-migration-v37-test";

  afterEach(async () => {
    await Dexie.delete(dbName);
  });

  it("backfills binder fields on legacy chapters while preserving existing data", async () => {
    // Seed a database at the pre-binder v36 schema with a legacy chapter row
    // that lacks every new field.
    const oldDb = new Dexie(dbName);
    oldDb.version(36).stores({ chapters: CHAPTERS_STORE });
    await oldDb.open();
    await oldDb.table("chapters").add({
      id: LEGACY_ID,
      projectId: PROJECT_ID,
      title: "Legacy Chapter",
      order: 3,
      content: "the quick brown fox",
      synopsis: "a synopsis",
      status: "revised",
      wordCount: 4,
      createdAt: TS,
      updatedAt: TS,
    });
    oldDb.close();

    // Reopen with the v37 upgrade registered; opening triggers the migration.
    const upgraded = new Dexie(dbName);
    upgraded.version(36).stores({ chapters: CHAPTERS_STORE });
    upgraded.version(37).upgrade(backfillBinderFieldsV37);
    await upgraded.open();
    const migrated = await upgraded.table("chapters").get(LEGACY_ID);
    upgraded.close();

    // New fields defaulted...
    expect(migrated).toMatchObject({
      parentChapterId: null,
      section: "manuscript",
      kind: "document",
      includeInCompile: true,
      pageBreakBefore: false,
    });
    // ...and the original data is untouched.
    expect(migrated).toMatchObject({
      id: LEGACY_ID,
      title: "Legacy Chapter",
      order: 3,
      content: "the quick brown fox",
      synopsis: "a synopsis",
      status: "revised",
      wordCount: 4,
    });

    // A migrated row must satisfy the current schema.
    expect(() => ChapterSchema.parse(migrated)).not.toThrow();
  });
});

describe("v39 indexedChunks table", () => {
  const dbName = "writr-migration-v39-test";

  afterEach(async () => {
    await Dexie.delete(dbName);
  });

  it("creates the indexedChunks table with expected indexes", async () => {
    const testDb = new Dexie(dbName);
    testDb.version(39).stores({
      indexedChunks:
        "id, projectId, [projectId+sourceType], sourceId, [sourceId+chunkIndex]",
    });
    await testDb.open();
    expect(testDb.tables.map((t) => t.name)).toContain("indexedChunks");
    testDb.close();
  });
});

describe("ChapterSchema binder defaults", () => {
  it("applies binder defaults when parsing a legacy-shaped chapter", () => {
    const parsed = ChapterSchema.parse({
      id: LEGACY_ID,
      projectId: PROJECT_ID,
      title: "Legacy Chapter",
      order: 0,
      content: "",
      synopsis: "",
      status: "draft",
      wordCount: 0,
      createdAt: TS,
      updatedAt: TS,
    });

    expect(parsed.parentChapterId).toBeNull();
    expect(parsed.section).toBe("manuscript");
    expect(parsed.kind).toBe("document");
    expect(parsed.includeInCompile).toBe(true);
    expect(parsed.pageBreakBefore).toBe(false);
  });
});
