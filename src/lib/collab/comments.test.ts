import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { YjsCommentsAdapter } from "./comments";

/**
 * These tests exercise the Y.Doc-backed comment store WITHOUT a real TipTap
 * editor. With `editor: null`, the adapter falls back to the captured
 * initial PM offsets (initialFrom/initialTo) instead of CRDT-resolved
 * positions. That's enough to validate replication semantics, mirror
 * callbacks, and permission gates.
 *
 * Anchor stability under concurrent prose edits is exercised in the
 * end-to-end host/guest manual checks listed in the plan; spinning up a
 * full TipTap editor with the Yjs binding for unit tests is too heavy.
 */

const ALL_PERMS = {
  canCreate: true,
  canEdit: true,
  canResolve: true,
  canDelete: true,
};

const VIEW_PERMS = {
  canCreate: false,
  canEdit: false,
  canResolve: false,
  canDelete: false,
};

const CHAPTER_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID = "00000000-0000-4000-8000-0000000000aa";

function makeTwoConnectedDocs(): { a: Y.Doc; b: Y.Doc; sync: () => void } {
  // Manual relay: forward updates from each doc to the other on demand.
  const a = new Y.Doc();
  const b = new Y.Doc();
  const fromA: Uint8Array[] = [];
  const fromB: Uint8Array[] = [];
  a.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== b) fromA.push(u);
  });
  b.on("update", (u: Uint8Array, origin: unknown) => {
    if (origin !== a) fromB.push(u);
  });
  function sync() {
    while (fromA.length > 0) {
      const update = fromA.shift();
      if (update) Y.applyUpdate(b, update, a);
    }
    while (fromB.length > 0) {
      const update = fromB.shift();
      if (update) Y.applyUpdate(a, update, b);
    }
  }
  return { a, b, sync };
}

describe("YjsCommentsAdapter", () => {
  let docs: ReturnType<typeof makeTwoConnectedDocs>;
  let onChangeA: ReturnType<typeof vi.fn<() => void>>;
  let onChangeB: ReturnType<typeof vi.fn<() => void>>;
  let adapterA: YjsCommentsAdapter;
  let adapterB: YjsCommentsAdapter;

  beforeEach(() => {
    docs = makeTwoConnectedDocs();
    onChangeA = vi.fn<() => void>();
    onChangeB = vi.fn<() => void>();
    adapterA = new YjsCommentsAdapter({
      commentsDoc: docs.a,
      editor: null,
      chapterId: CHAPTER_ID,
      projectId: PROJECT_ID,
      permissions: ALL_PERMS,
      author: "Alice",
      authorColor: "#10b981",
      onChange: () => onChangeA(),
    });
    adapterB = new YjsCommentsAdapter({
      commentsDoc: docs.b,
      editor: null,
      chapterId: CHAPTER_ID,
      projectId: PROJECT_ID,
      permissions: ALL_PERMS,
      author: "Bob",
      authorColor: "#f43f5e",
      onChange: () => onChangeB(),
    });
  });

  afterEach(() => {
    adapterA.destroy();
    adapterB.destroy();
  });

  it("propagates a created comment from A to B", async () => {
    const id = await adapterA.create({
      fromOffset: 5,
      toOffset: 12,
      anchorText: "hello",
      content: "first comment",
      color: "blue",
    });
    expect(adapterA.comments).toHaveLength(1);
    expect(adapterB.comments).toHaveLength(0);

    docs.sync();

    expect(adapterB.comments).toHaveLength(1);
    const remote = adapterB.comments[0];
    expect(remote.id).toBe(id);
    expect(remote.fromOffset).toBe(5);
    expect(remote.toOffset).toBe(12);
    expect(remote.content).toBe("first comment");
    expect(remote.color).toBe("blue");
    expect(remote.author).toBe("Alice");
    expect(remote.authorColor).toBe("#10b981");
  });

  it("propagates updates back the other way", async () => {
    const id = await adapterA.create({
      fromOffset: 1,
      toOffset: 1,
      content: "draft",
    });
    docs.sync();
    await adapterB.update(id, { content: "edited", color: "red" });
    docs.sync();
    expect(adapterA.comments[0].content).toBe("edited");
    expect(adapterA.comments[0].color).toBe("red");
  });

  it("resolves a comment on one side and reflects on the other", async () => {
    const id = await adapterA.create({ fromOffset: 1, toOffset: 1 });
    docs.sync();
    await adapterB.resolve(id);
    docs.sync();
    expect(adapterA.comments[0].status).toBe("resolved");
    expect(adapterA.comments[0].resolvedAt).not.toBeNull();
  });

  it("removes a comment on one side and reflects on the other", async () => {
    const id = await adapterA.create({ fromOffset: 1, toOffset: 1 });
    docs.sync();
    await adapterB.remove(id);
    docs.sync();
    expect(adapterA.comments).toHaveLength(0);
  });

  it("notifies via onChange when remote updates arrive", async () => {
    onChangeA.mockClear();
    onChangeB.mockClear();
    await adapterA.create({ fromOffset: 1, toOffset: 1, content: "x" });
    expect(onChangeA).toHaveBeenCalled();
    docs.sync();
    expect(onChangeB).toHaveBeenCalled();
  });

  it("rejects create / update / resolve / remove for view-only permissions", async () => {
    adapterA.destroy();
    adapterA = new YjsCommentsAdapter({
      commentsDoc: docs.a,
      editor: null,
      chapterId: CHAPTER_ID,
      projectId: PROJECT_ID,
      permissions: VIEW_PERMS,
      onChange: () => onChangeA(),
    });
    await expect(
      adapterA.create({ fromOffset: 1, toOffset: 1 }),
    ).rejects.toThrow();
    // Seed a row from B so update/resolve/remove targets exist locally
    const id = await adapterB.create({ fromOffset: 1, toOffset: 1 });
    docs.sync();
    await expect(adapterA.update(id, { content: "x" })).rejects.toThrow();
    await expect(adapterA.resolve(id)).rejects.toThrow();
    await expect(adapterA.remove(id)).rejects.toThrow();
  });

  it("invokes the host-side dexie mirror for both local and remote mutations", async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    adapterA.destroy();
    adapterA = new YjsCommentsAdapter({
      commentsDoc: docs.a,
      editor: null,
      chapterId: CHAPTER_ID,
      projectId: PROJECT_ID,
      permissions: ALL_PERMS,
      onChange: () => onChangeA(),
      dexieMirror: { upsert, remove },
    });

    // Local create on the host → mirror called inline
    const localId = await adapterA.create({
      fromOffset: 1,
      toOffset: 1,
      content: "local",
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({ id: localId });

    // Remote create from peer B → mirror called via observer
    const remoteId = await adapterB.create({
      fromOffset: 5,
      toOffset: 5,
      content: "remote",
    });
    docs.sync();
    // Allow microtask queue to flush mirror calls scheduled by observer
    await new Promise((r) => setTimeout(r, 0));
    const remoteUpsert = upsert.mock.calls.find(
      (call) => call[0].id === remoteId,
    );
    expect(remoteUpsert).toBeDefined();

    // Remote remove → mirror.remove called via observer
    await adapterB.remove(remoteId);
    docs.sync();
    await new Promise((r) => setTimeout(r, 0));
    expect(remove).toHaveBeenCalledWith(remoteId);
  });

  it("supports seedFromDexie when the map is empty (host startup)", () => {
    const dummy = {
      id: "11111111-1111-4111-8111-111111111111",
      projectId: PROJECT_ID,
      chapterId: CHAPTER_ID,
      content: "old",
      color: "yellow" as const,
      fromOffset: 3,
      toOffset: 8,
      anchorText: "abc",
      status: "active" as const,
      resolvedAt: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    adapterA.seedFromDexie([dummy]);
    docs.sync();
    expect(adapterB.comments).toHaveLength(1);
    expect(adapterB.comments[0].id).toBe(dummy.id);
    expect(adapterB.comments[0].fromOffset).toBe(3);
  });

  it("hides anchor-bearing entries until an editor binds (refresh-race guard)", () => {
    // Hand-write an entry with `anchorFrom` set into Y.Map. This mimics
    // an entry that was created on another peer with a real editor, then
    // arrives here while our editor is still null (the bug repro).
    const entry = new Y.Map<unknown>();
    entry.set("id", "33333333-3333-4333-8333-333333333333");
    entry.set("projectId", PROJECT_ID);
    entry.set("chapterId", CHAPTER_ID);
    entry.set("content", "remote");
    entry.set("color", "yellow");
    entry.set("status", "active");
    entry.set("resolvedAt", null);
    entry.set("anchorText", "");
    entry.set("initialFrom", 5);
    entry.set("initialTo", 5);
    // Garbage anchor: decode/resolve returns null, simulating the
    // "binding not yet ready" case without needing a real editor.
    entry.set("anchorFrom", "AAAA");
    entry.set("anchorTo", "AAAA");
    entry.set("createdAt", "2024-01-01T00:00:00.000Z");
    entry.set("updatedAt", "2024-01-01T00:00:00.000Z");
    docs.a
      .getMap("byId")
      .set("33333333-3333-4333-8333-333333333333", entry as Y.Map<unknown>);

    // With editor=null and an anchor present, the adapter must NOT
    // expose the entry — falling back to initialFrom would seed a
    // stale offset into the Comments plugin's positionMap.
    expect(adapterA.comments).toHaveLength(0);
  });

  it("seedFromDexie is a no-op when the map already has comments", async () => {
    await adapterA.create({ fromOffset: 1, toOffset: 2, content: "first" });
    docs.sync();
    adapterB.seedFromDexie([
      {
        id: "22222222-2222-4222-8222-222222222222",
        projectId: PROJECT_ID,
        chapterId: CHAPTER_ID,
        content: "should-not-add",
        color: "yellow",
        fromOffset: 10,
        toOffset: 20,
        anchorText: "",
        status: "active",
        resolvedAt: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
    expect(adapterB.comments).toHaveLength(1);
    expect(adapterB.comments[0].content).toBe("first");
  });
});
