import type { Dexie, Transaction } from "dexie";

/**
 * v44 migration: give every existing chapter *document* a backfilled "core
 * scene" (order 0) so scene count is always >= 1 and the Details panel has a
 * row to bind to. Separators hold no prose and get no scene. Exported so the
 * migration can be unit-tested directly against a v43→v44 upgrade.
 */
export async function backfillCoreScenesV44(tx: Transaction): Promise<void> {
  const chapters = await tx.table("chapters").toArray();
  const ts = new Date().toISOString();
  const rows = chapters
    .filter((c) => (c.kind ?? "document") !== "separator")
    .map((c) => ({
      id: crypto.randomUUID(),
      projectId: c.projectId,
      chapterId: c.id,
      order: 0,
      title: "",
      status: c.status ?? "draft",
      povCharacterId: null,
      presentCharacterIds: [],
      locationIds: [],
      timelineMode: "linear",
      strands: [],
      storyDate: "",
      storyTime: "",
      targetWordCount: 0,
      wordCount: c.wordCount ?? 0,
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    }));
  if (rows.length) await tx.table("scenes").bulkAdd(rows);
}

/**
 * v46 migration: backfill `coverImageUrl` on legacy project rows. Project reads
 * return raw Dexie rows (no Zod parse), so legacy rows would otherwise carry
 * `undefined`. Exported so the migration can be unit-tested directly against a
 * v45→v46 upgrade.
 */
export async function backfillProjectCoverV46(tx: Transaction): Promise<void> {
  await tx
    .table("projects")
    .toCollection()
    .modify((p: Record<string, unknown>) => {
      if (p.coverImageUrl === undefined) p.coverImageUrl = "";
    });
}

/** Applies migration version 41 onward to the given database. */
export function applyV41Plus(db: Dexie): void {
  // v41: style guide & guardrail entries gain global scope (projectId may be
  // null) and a per-project `disabledProjectIds` list. No `.stores()` change —
  // the existing indexes stay; global rows (null projectId) are not indexed by
  // IndexedDB and are scanned in JS instead. Backfill `disabledProjectIds = []`
  // so legacy rows survive Zod parse and `.includes` checks.
  db.version(41).upgrade(async (tx) => {
    await tx
      .table("styleGuideEntries")
      .toCollection()
      .modify((e: { disabledProjectIds?: unknown }) => {
        if (!Array.isArray(e.disabledProjectIds)) e.disabledProjectIds = [];
      });
    await tx
      .table("guardrailEntries")
      .toCollection()
      .modify((e: { disabledProjectIds?: unknown }) => {
        if (!Array.isArray(e.disabledProjectIds)) e.disabledProjectIds = [];
      });
  });

  // v42: remove the agent "pipeline" feature. Chat-mode sub-agent delegation
  // replaces it. Drop every pipeline-only store (setting it to null deletes
  // the object store). chapterSummaries and the agents definition table stay.
  db.version(42)
    .stores({
      agentRuns: null,
      readerBibleLog: null,
      readerBibleView: null,
      agentNotes: null,
      agentQuestions: null,
      workUnits: null,
      editPlans: null,
      proposedEdits: null,
      verifications: null,
      snapshotManifests: null,
    })
    .upgrade(async (tx) => {
      // Drop the now-removed pipeline-internal agent definitions so they
      // don't linger as rows of an unknown kind.
      await tx
        .table("agents")
        .where("kind")
        .anyOf("orchestrator", "verifier")
        .delete();
    });

  // Backfill `builtinKey` on pre-existing saved prompts. Reads of saved
  // prompts return raw Dexie rows (no Zod parse), so legacy rows would carry
  // `undefined` and be misclassified as built-in; normalize them to null.
  db.version(43).upgrade(async (tx) => {
    await tx
      .table("savedPrompts")
      .toCollection()
      .modify((p) => {
        if (p.builtinKey === undefined) p.builtinKey = null;
      });
  });

  // v44: scenes table (Model D). A chapter is still one TipTap document;
  // scenes are delimited inside it by `sceneBreak` marker nodes carrying a
  // sceneId. Rows hold metadata/identity/ordering only, never prose. Indexed
  // by chapter for the per-chapter ordered query and by project for
  // cascade/backup/strand aggregation. Every existing chapter document gets a
  // backfilled core scene (order 0) so scene count is always >= 1.
  db.version(44)
    .stores({
      scenes: "id, projectId, chapterId, [chapterId+order]",
    })
    .upgrade(async (tx) => {
      await backfillCoreScenesV44(tx);
    });

  db.version(45).upgrade((tx) =>
    tx
      .table("characters")
      .toCollection()
      .modify((c) => {
        if (c.summary === undefined) c.summary = "";
      }),
  );

  db.version(46).upgrade(backfillProjectCoverV46);
}
