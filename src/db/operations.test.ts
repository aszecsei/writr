import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./database";
import {
  createChapter,
  createCharacter,
  createLocation,
  createOutlineCard,
  createOutlineColumn,
  createProject,
  createRelationship,
  createStyleGuideEntry,
  createTimelineEvent,
  createWorldbuildingDoc,
  deleteOutlineColumn,
  deleteProject,
  deleteWorldbuildingDoc,
  getChaptersByProject,
  getCharactersByProject,
  getLocationsByProject,
  getOutlineCardsByProject,
  getOutlineColumnsByProject,
  getRelationshipsByProject,
  getStyleGuideByProject,
  getTimelineByProject,
  getWorldbuildingDoc,
  getWorldbuildingDocsByProject,
  moveOutlineCards,
  updateWorldbuildingDoc,
} from "./operations";

beforeEach(async () => {
  await db.projects.clear();
  await db.chapters.clear();
  await db.characters.clear();
  await db.locations.clear();
  await db.timelineEvents.clear();
  await db.styleGuideEntries.clear();
  await db.worldbuildingDocs.clear();
  await db.characterRelationships.clear();
  await db.outlineColumns.clear();
  await db.outlineCards.clear();
  await db.appSettings.clear();
});

describe("deleteProject (cascading delete)", () => {
  it("deletes project and all child entities", async () => {
    const project = await createProject({ title: "Doomed" });
    await createChapter({ projectId: project.id, title: "Ch1" });
    await createCharacter({ projectId: project.id, name: "Hero" });
    await createLocation({ projectId: project.id, name: "Town" });
    await createTimelineEvent({ projectId: project.id, title: "Event" });
    await createStyleGuideEntry({ projectId: project.id, title: "Rule" });
    await createWorldbuildingDoc({ projectId: project.id, title: "Lore" });
    const char1 = await createCharacter({ projectId: project.id, name: "A" });
    const char2 = await createCharacter({ projectId: project.id, name: "B" });
    await createRelationship({
      projectId: project.id,
      sourceCharacterId: char1.id,
      targetCharacterId: char2.id,
      type: "sibling",
    });
    const col = await createOutlineColumn({
      projectId: project.id,
      title: "Ideas",
    });
    await createOutlineCard({
      projectId: project.id,
      columnId: col.id,
      title: "Card",
    });

    await deleteProject(project.id);

    expect(await getChaptersByProject(project.id)).toHaveLength(0);
    expect(await getCharactersByProject(project.id)).toHaveLength(0);
    expect(await getLocationsByProject(project.id)).toHaveLength(0);
    expect(await getTimelineByProject(project.id)).toHaveLength(0);
    expect(await getStyleGuideByProject(project.id)).toHaveLength(0);
    expect(await getWorldbuildingDocsByProject(project.id)).toHaveLength(0);
    expect(await getRelationshipsByProject(project.id)).toHaveLength(0);
    expect(await getOutlineColumnsByProject(project.id)).toHaveLength(0);
    expect(await getOutlineCardsByProject(project.id)).toHaveLength(0);
  });

  it("does not affect other projects", async () => {
    const doomed = await createProject({ title: "Doomed" });
    const safe = await createProject({ title: "Safe" });
    await createChapter({ projectId: doomed.id, title: "Ch1" });
    await createChapter({ projectId: safe.id, title: "Ch2" });

    await deleteProject(doomed.id);

    expect(await getChaptersByProject(safe.id)).toHaveLength(1);
  });
});

describe("updateWorldbuildingDoc (cycle detection)", () => {
  it("throws on direct cycle (parent moved under child)", async () => {
    const project = await createProject({ title: "P" });
    const parent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Parent",
    });
    const child = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child",
      parentDocId: parent.id,
    });

    await expect(
      updateWorldbuildingDoc(parent.id, { parentDocId: child.id }),
    ).rejects.toThrow("Cannot move a document under one of its own children.");
  });

  it("throws on indirect cycle (A->B->C, move A under C)", async () => {
    const project = await createProject({ title: "P" });
    const a = await createWorldbuildingDoc({
      projectId: project.id,
      title: "A",
    });
    const b = await createWorldbuildingDoc({
      projectId: project.id,
      title: "B",
      parentDocId: a.id,
    });
    const c = await createWorldbuildingDoc({
      projectId: project.id,
      title: "C",
      parentDocId: b.id,
    });

    await expect(
      updateWorldbuildingDoc(a.id, { parentDocId: c.id }),
    ).rejects.toThrow("Cannot move a document under one of its own children.");
  });

  it("throws on self-reference", async () => {
    const project = await createProject({ title: "P" });
    const doc = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Self",
    });

    await expect(
      updateWorldbuildingDoc(doc.id, { parentDocId: doc.id }),
    ).rejects.toThrow("Cannot move a document under one of its own children.");
  });

  it("allows valid reparenting", async () => {
    const project = await createProject({ title: "P" });
    const a = await createWorldbuildingDoc({
      projectId: project.id,
      title: "A",
    });
    const b = await createWorldbuildingDoc({
      projectId: project.id,
      title: "B",
    });

    await expect(
      updateWorldbuildingDoc(b.id, { parentDocId: a.id }),
    ).resolves.toBeUndefined();
  });

  it("allows moving to root (null parent)", async () => {
    const project = await createProject({ title: "P" });
    const parent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Parent",
    });
    const child = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child",
      parentDocId: parent.id,
    });

    await expect(
      updateWorldbuildingDoc(child.id, { parentDocId: null }),
    ).resolves.toBeUndefined();
  });
});

describe("deleteWorldbuildingDoc (re-parenting)", () => {
  it("children adopted by deleted doc's parent", async () => {
    const project = await createProject({ title: "P" });
    const grandparent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Grandparent",
    });
    const parent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Parent",
      parentDocId: grandparent.id,
    });
    const child = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child",
      parentDocId: parent.id,
    });

    await deleteWorldbuildingDoc(parent.id);

    const updated = await getWorldbuildingDoc(child.id);
    expect(updated?.parentDocId).toBe(grandparent.id);
  });

  it("root doc deleted -> children become roots", async () => {
    const project = await createProject({ title: "P" });
    const root = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Root",
    });
    const child = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child",
      parentDocId: root.id,
    });

    await deleteWorldbuildingDoc(root.id);

    const updated = await getWorldbuildingDoc(child.id);
    expect(updated?.parentDocId).toBeNull();
  });

  it("non-existent doc returns silently", async () => {
    await expect(
      deleteWorldbuildingDoc("00000000-0000-4000-8000-ffffffffffff"),
    ).resolves.toBeUndefined();
  });

  it("leaf doc deletion leaves parent intact", async () => {
    const project = await createProject({ title: "P" });
    const parent = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Parent",
    });
    const leaf = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Leaf",
      parentDocId: parent.id,
    });

    await deleteWorldbuildingDoc(leaf.id);

    const parentDoc = await getWorldbuildingDoc(parent.id);
    expect(parentDoc).toBeDefined();
    expect(parentDoc?.title).toBe("Parent");
  });
});

describe("createRelationship (duplicate & self-ref prevention)", () => {
  it("throws on self-relationship", async () => {
    const project = await createProject({ title: "P" });
    const char = await createCharacter({ projectId: project.id, name: "Solo" });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: char.id,
        targetCharacterId: char.id,
        type: "sibling",
      }),
    ).rejects.toThrow("A character cannot have a relationship with itself.");
  });

  it("throws on exact duplicate (same direction)", async () => {
    const project = await createProject({ title: "P" });
    const a = await createCharacter({ projectId: project.id, name: "A" });
    const b = await createCharacter({ projectId: project.id, name: "B" });

    await createRelationship({
      projectId: project.id,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "sibling",
    });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: a.id,
        targetCharacterId: b.id,
        type: "sibling",
      }),
    ).rejects.toThrow("This exact relationship already exists.");
  });

  it("throws on bidirectional duplicate (reversed direction)", async () => {
    const project = await createProject({ title: "P" });
    const a = await createCharacter({ projectId: project.id, name: "A" });
    const b = await createCharacter({ projectId: project.id, name: "B" });

    await createRelationship({
      projectId: project.id,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "sibling",
    });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: b.id,
        targetCharacterId: a.id,
        type: "sibling",
      }),
    ).rejects.toThrow("This exact relationship already exists.");
  });

  it("allows same pair with different type", async () => {
    const project = await createProject({ title: "P" });
    const a = await createCharacter({ projectId: project.id, name: "A" });
    const b = await createCharacter({ projectId: project.id, name: "B" });

    await createRelationship({
      projectId: project.id,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "sibling",
    });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: a.id,
        targetCharacterId: b.id,
        type: "spouse",
      }),
    ).resolves.toBeDefined();
  });

  it("allows same pair/type with different customLabel", async () => {
    const project = await createProject({ title: "P" });
    const a = await createCharacter({ projectId: project.id, name: "A" });
    const b = await createCharacter({ projectId: project.id, name: "B" });

    await createRelationship({
      projectId: project.id,
      sourceCharacterId: a.id,
      targetCharacterId: b.id,
      type: "custom",
      customLabel: "nemesis",
    });

    await expect(
      createRelationship({
        projectId: project.id,
        sourceCharacterId: a.id,
        targetCharacterId: b.id,
        type: "custom",
        customLabel: "rival",
      }),
    ).resolves.toBeDefined();
  });
});

describe("auto-order", () => {
  it("first entity gets order 0, second gets order 1", async () => {
    const project = await createProject({ title: "P" });
    const ch1 = await createChapter({ projectId: project.id, title: "Ch1" });
    const ch2 = await createChapter({ projectId: project.id, title: "Ch2" });
    expect(ch1.order).toBe(0);
    expect(ch2.order).toBe(1);
  });

  it("explicit order overrides auto-order", async () => {
    const project = await createProject({ title: "P" });
    const ch = await createChapter({
      projectId: project.id,
      title: "Ch",
      order: 42,
    });
    expect(ch.order).toBe(42);
  });

  it("worldbuilding doc order is scoped by parentDocId", async () => {
    const project = await createProject({ title: "P" });
    const root1 = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Root1",
    });
    const root2 = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Root2",
    });
    const child1 = await createWorldbuildingDoc({
      projectId: project.id,
      title: "Child1",
      parentDocId: root1.id,
    });

    // root1 and root2 are both roots (parentDocId=null), auto-ordered 0,1
    expect(root1.order).toBe(0);
    expect(root2.order).toBe(1);
    // child1 is under root1, so it starts at 0 within that scope
    expect(child1.order).toBe(0);
  });
});

describe("outline columns", () => {
  it("creates columns with auto-order", async () => {
    const project = await createProject({ title: "P" });
    const col1 = await createOutlineColumn({
      projectId: project.id,
      title: "Ideas",
    });
    const col2 = await createOutlineColumn({
      projectId: project.id,
      title: "In Progress",
    });
    expect(col1.order).toBe(0);
    expect(col2.order).toBe(1);
  });

  it("returns columns sorted by order", async () => {
    const project = await createProject({ title: "P" });
    await createOutlineColumn({
      projectId: project.id,
      title: "B",
      order: 1,
    });
    await createOutlineColumn({
      projectId: project.id,
      title: "A",
      order: 0,
    });
    const cols = await getOutlineColumnsByProject(project.id);
    expect(cols[0].title).toBe("A");
    expect(cols[1].title).toBe("B");
  });

  it("deleteOutlineColumn cascades to cards", async () => {
    const project = await createProject({ title: "P" });
    const col = await createOutlineColumn({
      projectId: project.id,
      title: "Ideas",
    });
    await createOutlineCard({
      projectId: project.id,
      columnId: col.id,
      title: "Card1",
    });
    await createOutlineCard({
      projectId: project.id,
      columnId: col.id,
      title: "Card2",
    });

    await deleteOutlineColumn(col.id);

    expect(await getOutlineColumnsByProject(project.id)).toHaveLength(0);
    expect(await getOutlineCardsByProject(project.id)).toHaveLength(0);
  });
});

describe("outline cards", () => {
  it("creates cards with auto-order within column", async () => {
    const project = await createProject({ title: "P" });
    const col = await createOutlineColumn({
      projectId: project.id,
      title: "Ideas",
    });
    const card1 = await createOutlineCard({
      projectId: project.id,
      columnId: col.id,
      title: "Card1",
    });
    const card2 = await createOutlineCard({
      projectId: project.id,
      columnId: col.id,
      title: "Card2",
    });
    expect(card1.order).toBe(0);
    expect(card2.order).toBe(1);
  });

  it("cards default to yellow color", async () => {
    const project = await createProject({ title: "P" });
    const col = await createOutlineColumn({
      projectId: project.id,
      title: "Ideas",
    });
    const card = await createOutlineCard({
      projectId: project.id,
      columnId: col.id,
      title: "Card1",
    });
    expect(card.color).toBe("yellow");
  });

  it("moveOutlineCards updates columnId and order atomically", async () => {
    const project = await createProject({ title: "P" });
    const col1 = await createOutlineColumn({
      projectId: project.id,
      title: "A",
    });
    const col2 = await createOutlineColumn({
      projectId: project.id,
      title: "B",
    });
    const card1 = await createOutlineCard({
      projectId: project.id,
      columnId: col1.id,
      title: "Card1",
    });
    const card2 = await createOutlineCard({
      projectId: project.id,
      columnId: col1.id,
      title: "Card2",
    });

    // Move card1 to col2 at position 0, card2 stays in col1 at position 0
    await moveOutlineCards([
      { id: card1.id, columnId: col2.id, order: 0 },
      { id: card2.id, columnId: col1.id, order: 0 },
    ]);

    const allCards = await getOutlineCardsByProject(project.id);
    const movedCard = allCards.find((c) => c.id === card1.id);
    expect(movedCard?.columnId).toBe(col2.id);
    expect(movedCard?.order).toBe(0);

    const stayedCard = allCards.find((c) => c.id === card2.id);
    expect(stayedCard?.columnId).toBe(col1.id);
    expect(stayedCard?.order).toBe(0);
  });
});
