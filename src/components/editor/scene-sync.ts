import type { Editor } from "@tiptap/core";
import {
  createScene,
  deleteScene,
  getScenesByChapter,
  reorderScenes,
  updateSceneWordCounts,
} from "@/db/operations";
import type { ChapterId, ProjectId, SceneId } from "@/db/schemas";
import { countWordsExcludingHoles, type HoleDelimiters } from "@/lib/holes";
import { generateId } from "@/lib/id";

/** A `sceneBreak` node located in a chapter's document, in document order. */
interface Marker {
  /** Start position of the node. */
  start: number;
  /** Position immediately after the node (an atom's nodeSize is 1). */
  end: number;
  sceneId: string | null;
}

/** Scan the top-level children for scene-break markers, in document order. */
function collectMarkers(editor: Editor): Marker[] {
  const markers: Marker[] = [];
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === "sceneBreak") {
      markers.push({
        start: offset,
        end: offset + node.nodeSize,
        sceneId: (node.attrs.sceneId as string | null) ?? null,
      });
    }
  });
  return markers;
}

/**
 * Phase A — resolve marker identity. Any marker with a null id (e.g. a pasted
 * `<hr>` that matched the parse rule) or a duplicate id (a copy-pasted marker)
 * gets a freshly minted id written back into the node. Runs synchronously so
 * the caller can serialize a document whose markers all carry unique, real ids
 * before persisting. Returns the resolved ids in document order.
 *
 * The attribute write is dispatched with `addToHistory: false` so it never
 * pollutes undo. It re-fires `onUpdate` (marking the editor dirty), but the
 * next reconcile finds all ids resolved and mints nothing, so it converges.
 */
export function ensureSceneIds(editor: Editor, mint: () => string): string[] {
  const markers = collectMarkers(editor);
  const seen = new Set<string>();
  const writes: { pos: number; sceneId: string }[] = [];
  const resolved = markers.map((m) => {
    let id = m.sceneId;
    if (!id || seen.has(id)) {
      id = mint();
      writes.push({ pos: m.start, sceneId: id });
    }
    seen.add(id);
    return id;
  });
  if (writes.length > 0) {
    let tr = editor.state.tr;
    for (const w of writes)
      tr = tr.setNodeAttribute(w.pos, "sceneId", w.sceneId);
    tr.setMeta("addToHistory", false);
    editor.view.dispatch(tr);
  }
  return resolved;
}

/** The DB-facing diff produced by {@link planSceneReconcile}. Pure + testable. */
export interface SceneReconcilePlan {
  /** Marker ids (plus a minted core id if none exists) needing a new Scene row. */
  toCreate: string[];
  /** Scene row ids to delete — orphans whose marker was removed. */
  toDelete: string[];
  /** Final order: core first, then markers in document order. */
  orderedIds: string[];
  /** The core scene id (existing lowest-order coreless row, or a minted one). */
  coreId: string;
}

/**
 * Pure reconciliation of Scene rows against the resolved marker ids. The core
 * scene is the content before the first marker; it is the one surviving row
 * with no marker (identified as the lowest-order coreless row). Any *other*
 * coreless row is an orphan left by a removed marker and is deleted.
 */
export function planSceneReconcile(
  markerIds: string[],
  existingRows: { id: string; order: number }[],
  mintCore: () => string,
): SceneReconcilePlan {
  const markerSet = new Set(markerIds);
  const existingIds = new Set(existingRows.map((r) => r.id));
  const coreless = existingRows
    .filter((r) => !markerSet.has(r.id))
    .sort((a, b) => a.order - b.order);

  const toCreate = markerIds.filter((id) => !existingIds.has(id));
  let coreId = coreless[0]?.id ?? null;
  if (!coreId) {
    coreId = mintCore();
    toCreate.unshift(coreId);
  }
  const toDelete = coreless.slice(1).map((r) => r.id);
  const orderedIds = [coreId, ...markerIds];
  return { toCreate, toDelete, orderedIds, coreId };
}

/**
 * Phase B — reconcile Scene rows for a chapter against its document markers and
 * write derived per-scene word counts. Call from the editor's save path, after
 * {@link ensureSceneIds} has resolved marker identity and the content has been
 * persisted. Prose only — screenplay documents have no scene breaks.
 */
export async function reconcileSceneRows(
  editor: Editor,
  chapterId: ChapterId,
  projectId: ProjectId,
  holeDelimiters: HoleDelimiters,
): Promise<void> {
  const markers = collectMarkers(editor);
  const markerIds = markers
    .map((m) => m.sceneId)
    .filter((id): id is string => Boolean(id));

  const rows = await getScenesByChapter(chapterId);
  const plan = planSceneReconcile(
    markerIds,
    rows,
    () => generateId() as string,
  );

  // Create missing rows. A marker row's order is fixed up by reorderScenes
  // below; the core row is order 0.
  for (const id of plan.toCreate) {
    const order = id === plan.coreId ? 0 : markerIds.indexOf(id) + 1;
    await createScene({
      id: id as SceneId,
      projectId,
      chapterId,
      order,
    });
  }
  for (const id of plan.toDelete) {
    await deleteScene(id as SceneId);
  }
  await reorderScenes(chapterId, plan.orderedIds as SceneId[]);

  // Derived word counts: slice the doc text at markers. The core scene runs
  // from the document start to the first marker; each subsequent scene runs
  // from its marker to the next marker (or the document end).
  const doc = editor.state.doc;
  const counts = new Map<SceneId, number>();
  const coreEnd = markers[0]?.start ?? doc.content.size;
  counts.set(
    plan.coreId as SceneId,
    countWordsExcludingHoles(
      doc.textBetween(0, coreEnd, "\n", "\n"),
      holeDelimiters,
    ),
  );
  for (let i = 0; i < markers.length; i++) {
    const from = markers[i].end;
    const to = markers[i + 1]?.start ?? doc.content.size;
    const id = markers[i].sceneId;
    if (!id) continue;
    counts.set(
      id as SceneId,
      countWordsExcludingHoles(
        doc.textBetween(from, to, "\n", "\n"),
        holeDelimiters,
      ),
    );
  }
  await updateSceneWordCounts(counts);
}

/**
 * The id of the scene the caret sits in: the core scene until the first marker,
 * then the scene that each marker begins. Returns null when the chapter has no
 * scene rows loaded yet. `sceneIdsInOrder` is `[coreId, ...markerIds]` — the
 * same order {@link reconcileSceneRows} maintains.
 */
export function activeSceneAt(
  editor: Editor,
  sceneIdsInOrder: string[],
): string | null {
  if (sceneIdsInOrder.length === 0) return null;
  const caret = editor.state.selection.from;
  const markers = collectMarkers(editor);
  // Count how many markers start at or before the caret → index into the
  // ordered scene list (0 = core).
  let index = 0;
  for (const m of markers) {
    if (m.start < caret) index++;
    else break;
  }
  return sceneIdsInOrder[Math.min(index, sceneIdsInOrder.length - 1)] ?? null;
}
