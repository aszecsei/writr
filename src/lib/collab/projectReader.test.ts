import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { ChapterId, CharacterId } from "@/db/schemas";
import { useSharedProjectStore } from "@/store/sharedProjectStore";
import { PROJECT_DOC_VERSION } from "./projectDoc";
import { ProjectMirror } from "./projectMirror";
import { attachProjectReader } from "./projectReader";
import { chapter, character, emptySnapshot, PROJECT_ID } from "./test-support";

const CHAPTER_ID_1 = "00000000-0000-4000-8000-000000000001" as ChapterId;
const CHAPTER_ID_2 = "00000000-0000-4000-8000-000000000002" as ChapterId;
const CHARACTER_ID_1 = "00000000-0000-4000-8000-000000000011" as CharacterId;

const REMOTE_ORIGIN = Symbol("remote");

function relay(host: Y.Doc, guest: Y.Doc): void {
  host.on("update", (update) => {
    Y.applyUpdate(guest, update, REMOTE_ORIGIN);
  });
}

beforeEach(() => {
  useSharedProjectStore.getState().reset();
});

describe("attachProjectReader", () => {
  it("seeds the store from existing doc state on attach", () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();

    const mirror = new ProjectMirror({ doc: host, projectId: PROJECT_ID });
    mirror.seedFromSnapshot({
      ...emptySnapshot(),
      activeChapterId: CHAPTER_ID_1,
      chapters: [chapter(CHAPTER_ID_1)],
      characters: [character(CHARACTER_ID_1)],
    });
    Y.applyUpdate(guest, Y.encodeStateAsUpdate(host), REMOTE_ORIGIN);

    attachProjectReader({ doc: guest, store: useSharedProjectStore });

    const state = useSharedProjectStore.getState();
    expect(state.byTable.chapters.get(CHAPTER_ID_1)?.title).toBe("Ch 1");
    expect(state.byTable.characters.get(CHARACTER_ID_1)?.name).toBe("Alice");
    expect(state.project?.id).toBe(PROJECT_ID);
    expect(state.meta).toEqual({
      projectId: PROJECT_ID,
      activeChapterId: CHAPTER_ID_1,
      revision: 1,
      version: PROJECT_DOC_VERSION,
    });
  });

  it("propagates host upserts to the guest store as the doc updates", () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();
    relay(host, guest);

    const mirror = new ProjectMirror({ doc: host, projectId: PROJECT_ID });
    attachProjectReader({ doc: guest, store: useSharedProjectStore });

    mirror.syncTable("chapters", [chapter(CHAPTER_ID_1)]);
    expect(useSharedProjectStore.getState().byTable.chapters.size).toBe(1);

    mirror.syncTable("chapters", [chapter(CHAPTER_ID_1, { title: "Renamed" })]);
    expect(
      useSharedProjectStore.getState().byTable.chapters.get(CHAPTER_ID_1)
        ?.title,
    ).toBe("Renamed");

    mirror.syncTable("chapters", [chapter(CHAPTER_ID_2)]);
    const after = useSharedProjectStore.getState().byTable.chapters;
    expect(after.has(CHAPTER_ID_1)).toBe(false);
    expect(after.get(CHAPTER_ID_2)?.title).toBe("Ch 2");
  });

  it("propagates meta updates from host to guest", () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();
    relay(host, guest);

    const mirror = new ProjectMirror({ doc: host, projectId: PROJECT_ID });
    attachProjectReader({ doc: guest, store: useSharedProjectStore });

    mirror.seedFromSnapshot({
      ...emptySnapshot(),
      activeChapterId: CHAPTER_ID_1,
    });
    expect(useSharedProjectStore.getState().meta?.activeChapterId).toBe(
      CHAPTER_ID_1,
    );

    mirror.setActiveChapterId(CHAPTER_ID_2);
    expect(useSharedProjectStore.getState().meta?.activeChapterId).toBe(
      CHAPTER_ID_2,
    );
  });

  it("detach unsubscribes all observers", () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();
    relay(host, guest);

    const mirror = new ProjectMirror({ doc: host, projectId: PROJECT_ID });
    const detach = attachProjectReader({
      doc: guest,
      store: useSharedProjectStore,
    });

    mirror.syncTable("chapters", [chapter(CHAPTER_ID_1)]);
    const beforeDetach = useSharedProjectStore.getState().byTable.chapters.size;
    expect(beforeDetach).toBe(1);

    detach();
    mirror.syncTable("chapters", [
      chapter(CHAPTER_ID_1),
      chapter(CHAPTER_ID_2),
    ]);
    expect(useSharedProjectStore.getState().byTable.chapters.size).toBe(
      beforeDetach,
    );
  });
});
