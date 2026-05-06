import type { Editor } from "@tiptap/react";
import * as Y from "yjs";
import { generateId } from "@/db/operations/helpers";
import {
  type Comment,
  type CommentColor,
  CommentSchema,
  type CommentStatus,
} from "@/db/schemas";
import type {
  CommentInput,
  CommentPatch,
  CommentsAdapter,
} from "@/lib/comments/adapter";
import { REMOTE_ORIGIN } from "./session";
import {
  encodeRelativeFromAbsolute,
  resolveAbsoluteFromRelative,
} from "./y-position";

/**
 * Permissions for the Yjs comments adapter. Mirrors collabSelectors, but
 * provided as plain booleans so the adapter doesn't reach into the store.
 */
export interface YjsCommentsPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canResolve: boolean;
  canDelete: boolean;
}

/**
 * Optional Dexie write-through, supplied by the host. Each callback is
 * invoked AFTER the Y.Map mutation completes, so guests' updates flow
 * through the host's IndexedDB without explicit coordination.
 */
export interface DexieMirror {
  upsert(comment: Comment): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface YjsCommentsAdapterOptions {
  commentsDoc: Y.Doc;
  editor: Editor | null;
  chapterId: string;
  projectId: string;
  permissions: YjsCommentsPermissions;
  /** Display name + color stamped onto comments this peer authors. */
  author?: string;
  authorColor?: string;
  /** When set, mirrors mutations to Dexie (host only). */
  dexieMirror?: DexieMirror;
  /** React notifier — called whenever the comment list changes. */
  onChange: () => void;
}

const META_KEY = "meta";
const BY_ID_KEY = "byId";

/**
 * Field names on the inner Y.Map for one comment. The schema mirrors
 * `Comment` in `db/schemas.ts`, but anchors are CRDT-anchored relative
 * positions instead of absolute PM offsets so concurrent prose edits
 * don't drift the highlight away from its target text.
 */
const FIELD = {
  id: "id",
  projectId: "projectId",
  chapterId: "chapterId",
  content: "content",
  color: "color",
  status: "status",
  resolvedAt: "resolvedAt",
  anchorText: "anchorText",
  /** Initial PM offset captured at create time (fallback if rel resolve fails). */
  initialFrom: "initialFrom",
  initialTo: "initialTo",
  /** base64 Y.RelativePosition into the prose Y.Doc. */
  anchorFrom: "anchorFrom",
  anchorTo: "anchorTo",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  author: "author",
  authorColor: "authorColor",
} as const;

type CommentEntry = Y.Map<unknown>;

function nowIso(): string {
  return new Date().toISOString();
}

function readEntryString(entry: CommentEntry, key: string): string {
  const v = entry.get(key);
  return typeof v === "string" ? v : "";
}

function readEntryNumber(entry: CommentEntry, key: string): number {
  const v = entry.get(key);
  return typeof v === "number" ? v : 0;
}

function readEntryNullableString(
  entry: CommentEntry,
  key: string,
): string | null {
  const v = entry.get(key);
  if (v === null) return null;
  return typeof v === "string" ? v : null;
}

function readEntryOptionalString(
  entry: CommentEntry,
  key: string,
): string | undefined {
  const v = entry.get(key);
  return typeof v === "string" ? v : undefined;
}

/**
 * Build a Comment object from a Y.Map entry. Live PM offsets are computed
 * on the fly from the stored relative positions (falling back to the
 * captured initial offsets when the editor isn't bound or the rel can't
 * resolve — for example, if the prose item was deleted).
 */
function entryToComment(
  entry: CommentEntry,
  editor: Editor | null,
): Comment | null {
  const id = readEntryString(entry, FIELD.id);
  if (!id) return null;

  const initialFrom = readEntryNumber(entry, FIELD.initialFrom);
  const initialTo = readEntryNumber(entry, FIELD.initialTo);

  const anchorFromEnc = readEntryOptionalString(entry, FIELD.anchorFrom);
  const anchorToEnc = readEntryOptionalString(entry, FIELD.anchorTo);

  // Anchor-bearing entries MUST resolve through the editor's Yjs binding
  // — `initialFrom` reflects the PM offset at create time and is wrong
  // the moment any peer has edited prose since. Holding the comment back
  // until resolution succeeds avoids polluting the Comments plugin's
  // positionMap with a stale offset (the plugin's "keep tracked position"
  // branch refuses to overwrite once seeded).
  let from = initialFrom;
  let to = initialTo;
  if (anchorFromEnc || anchorToEnc) {
    if (!editor) return null;
    const resolvedFrom = anchorFromEnc
      ? resolveAbsoluteFromRelative(editor, anchorFromEnc)
      : null;
    const resolvedTo = anchorToEnc
      ? resolveAbsoluteFromRelative(editor, anchorToEnc)
      : null;
    if (anchorFromEnc && resolvedFrom == null) return null;
    if (anchorToEnc && resolvedTo == null) return null;
    if (resolvedFrom != null) from = resolvedFrom;
    if (resolvedTo != null) to = resolvedTo;
  }
  // Comments collapsed below their from after resolving are clamped.
  if (to < from) to = from;

  const status =
    (readEntryOptionalString(entry, FIELD.status) as CommentStatus) ?? "active";
  const color =
    (readEntryOptionalString(entry, FIELD.color) as CommentColor) ?? "yellow";

  const draft: Comment = {
    id,
    projectId: readEntryString(entry, FIELD.projectId),
    chapterId: readEntryString(entry, FIELD.chapterId),
    content: readEntryString(entry, FIELD.content),
    color,
    fromOffset: from,
    toOffset: to,
    anchorText: readEntryString(entry, FIELD.anchorText),
    status,
    resolvedAt: readEntryNullableString(entry, FIELD.resolvedAt),
    author: readEntryOptionalString(entry, FIELD.author),
    authorColor: readEntryOptionalString(entry, FIELD.authorColor),
    createdAt: readEntryOptionalString(entry, FIELD.createdAt) ?? nowIso(),
    updatedAt: readEntryOptionalString(entry, FIELD.updatedAt) ?? nowIso(),
  };

  // Pass through Zod so optional defaults are filled and we never emit a
  // malformed Comment to consumers.
  const parsed = CommentSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}

/**
 * Adapter that uses a shared Y.Doc as the source of truth for comments.
 * The host additionally mirrors mutations into Dexie so comments persist
 * locally after the session ends.
 */
export class YjsCommentsAdapter implements CommentsAdapter {
  private readonly byId: Y.Map<CommentEntry>;
  private readonly meta: Y.Map<unknown>;
  private snapshot: Comment[] = [];
  private destroyed = false;
  private currentEditor: Editor | null;

  private readonly observer = (
    events: Y.YEvent<Y.AbstractType<unknown>>[],
    transaction: Y.Transaction,
  ) => {
    this.rebuildSnapshot();
    if (this.opts.dexieMirror) {
      // Mirror only AFTER the Y transaction commits. Skip snapshot-only
      // changes (no events on the byId map) so we don't redundantly
      // touch IndexedDB. Skip mirror writes for our own local mutations
      // when they originate from the same flow that already updated the
      // adapter's caller — but the host's create/update/resolve/remove
      // methods write through the mirror inline, so we only need to
      // catch *remote* changes here.
      if (transaction.origin !== this) {
        void this.mirrorEvents(events);
      }
    }
    this.opts.onChange();
  };

  constructor(private readonly opts: YjsCommentsAdapterOptions) {
    this.byId = opts.commentsDoc.getMap<CommentEntry>(BY_ID_KEY);
    this.meta = opts.commentsDoc.getMap<unknown>(META_KEY);
    this.currentEditor = opts.editor;
    this.byId.observeDeep(this.observer);
    this.rebuildSnapshot();
  }

  /**
   * Late-bind the editor. The TipTap editor materializes after the adapter
   * is constructed (the extension list depends on the adapter's
   * commentsRef), so this gets called once the editor is ready and again
   * if it's recreated (e.g. when collab toggles or chapters switch).
   */
  setEditor(editor: Editor | null): void {
    if (this.currentEditor === editor) return;
    this.currentEditor = editor;
    this.rebuildSnapshot();
    this.opts.onChange();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.byId.unobserveDeep(this.observer);
  }

  /** Used by the editor to mirror PM updates into the snapshot. */
  refresh(): void {
    this.rebuildSnapshot();
    this.opts.onChange();
  }

  /** Host-only: write `chapterId` / `projectId` so guests can read them. */
  writeMeta(chapterId: string, projectId: string): void {
    this.opts.commentsDoc.transact(() => {
      this.meta.set("chapterId", chapterId);
      this.meta.set("projectId", projectId);
    }, this);
  }

  /**
   * Host-only: copy Dexie comments into the Y.Map on session start IF
   * the map is empty. No-op if comments already exist (a peer with state
   * has already synced).
   */
  seedFromDexie(comments: Comment[]): void {
    if (this.byId.size > 0) return;
    if (comments.length === 0) return;
    this.opts.commentsDoc.transact(() => {
      for (const c of comments) {
        this.writeEntry(c.id, this.buildEntryFields(c));
      }
    }, this);
  }

  get comments(): Comment[] {
    return this.snapshot;
  }
  get canCreate(): boolean {
    return this.opts.permissions.canCreate;
  }
  get canEdit(): boolean {
    return this.opts.permissions.canEdit;
  }
  get canResolve(): boolean {
    return this.opts.permissions.canResolve;
  }
  get canDelete(): boolean {
    return this.opts.permissions.canDelete;
  }

  async create(input: CommentInput): Promise<string> {
    if (!this.canCreate) throw new Error("not allowed: create comment");
    const editor = this.currentEditor;
    const id = generateId();
    const ts = nowIso();
    const anchorFrom = editor
      ? encodeRelativeFromAbsolute(editor, input.fromOffset)
      : null;
    const anchorTo = editor
      ? encodeRelativeFromAbsolute(editor, input.toOffset)
      : null;
    const fields: Record<string, unknown> = {
      [FIELD.id]: id,
      [FIELD.projectId]: this.opts.projectId,
      [FIELD.chapterId]: this.opts.chapterId,
      [FIELD.content]: input.content ?? "",
      [FIELD.color]: input.color ?? "yellow",
      [FIELD.status]: "active",
      [FIELD.resolvedAt]: null,
      [FIELD.anchorText]: input.anchorText ?? "",
      [FIELD.initialFrom]: input.fromOffset,
      [FIELD.initialTo]: input.toOffset,
      [FIELD.anchorFrom]: anchorFrom,
      [FIELD.anchorTo]: anchorTo,
      [FIELD.createdAt]: ts,
      [FIELD.updatedAt]: ts,
      [FIELD.author]: input.author ?? this.opts.author,
      [FIELD.authorColor]: input.authorColor ?? this.opts.authorColor,
    };
    this.opts.commentsDoc.transact(() => {
      this.writeEntry(id, fields);
    }, this);
    if (this.opts.dexieMirror) {
      const c = entryToComment(
        this.byId.get(id) as CommentEntry,
        this.currentEditor,
      );
      if (c) await this.opts.dexieMirror.upsert(c);
    }
    return id;
  }

  async update(id: string, patch: CommentPatch): Promise<void> {
    if (!this.canEdit) throw new Error("not allowed: edit comment");
    const entry = this.byId.get(id);
    if (!entry) return;
    const editor = this.currentEditor;
    this.opts.commentsDoc.transact(() => {
      if (patch.content !== undefined) entry.set(FIELD.content, patch.content);
      if (patch.color !== undefined) entry.set(FIELD.color, patch.color);
      if (patch.status !== undefined) entry.set(FIELD.status, patch.status);
      if (patch.resolvedAt !== undefined)
        entry.set(FIELD.resolvedAt, patch.resolvedAt);
      if (patch.anchorText !== undefined)
        entry.set(FIELD.anchorText, patch.anchorText);
      if (patch.fromOffset !== undefined) {
        entry.set(FIELD.initialFrom, patch.fromOffset);
        if (editor) {
          entry.set(
            FIELD.anchorFrom,
            encodeRelativeFromAbsolute(editor, patch.fromOffset),
          );
        }
      }
      if (patch.toOffset !== undefined) {
        entry.set(FIELD.initialTo, patch.toOffset);
        if (editor) {
          entry.set(
            FIELD.anchorTo,
            encodeRelativeFromAbsolute(editor, patch.toOffset),
          );
        }
      }
      entry.set(FIELD.updatedAt, nowIso());
    }, this);
    if (this.opts.dexieMirror) {
      const c = entryToComment(entry, this.currentEditor);
      if (c) await this.opts.dexieMirror.upsert(c);
    }
  }

  async resolve(id: string): Promise<void> {
    if (!this.canResolve) throw new Error("not allowed: resolve comment");
    const entry = this.byId.get(id);
    if (!entry) return;
    const ts = nowIso();
    this.opts.commentsDoc.transact(() => {
      entry.set(FIELD.status, "resolved");
      entry.set(FIELD.resolvedAt, ts);
      entry.set(FIELD.updatedAt, ts);
    }, this);
    if (this.opts.dexieMirror) {
      const c = entryToComment(entry, this.currentEditor);
      if (c) await this.opts.dexieMirror.upsert(c);
    }
  }

  async remove(id: string): Promise<void> {
    if (!this.canDelete) throw new Error("not allowed: delete comment");
    if (!this.byId.has(id)) return;
    this.opts.commentsDoc.transact(() => {
      this.byId.delete(id);
    }, this);
    if (this.opts.dexieMirror) {
      await this.opts.dexieMirror.remove(id);
    }
  }

  private writeEntry(id: string, fields: Record<string, unknown>): void {
    const entry = new Y.Map<unknown>();
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      entry.set(key, value);
    }
    this.byId.set(id, entry);
  }

  private buildEntryFields(c: Comment): Record<string, unknown> {
    const editor = this.currentEditor;
    const anchorFrom = editor
      ? encodeRelativeFromAbsolute(editor, c.fromOffset)
      : null;
    const anchorTo = editor
      ? encodeRelativeFromAbsolute(editor, c.toOffset)
      : null;
    return {
      [FIELD.id]: c.id,
      [FIELD.projectId]: c.projectId,
      [FIELD.chapterId]: c.chapterId,
      [FIELD.content]: c.content,
      [FIELD.color]: c.color,
      [FIELD.status]: c.status,
      [FIELD.resolvedAt]: c.resolvedAt,
      [FIELD.anchorText]: c.anchorText,
      [FIELD.initialFrom]: c.fromOffset,
      [FIELD.initialTo]: c.toOffset,
      [FIELD.anchorFrom]: anchorFrom,
      [FIELD.anchorTo]: anchorTo,
      [FIELD.createdAt]: c.createdAt,
      [FIELD.updatedAt]: c.updatedAt,
      [FIELD.author]: c.author,
      [FIELD.authorColor]: c.authorColor,
    };
  }

  private rebuildSnapshot(): void {
    const editor = this.currentEditor;
    const next: Comment[] = [];
    this.byId.forEach((entry) => {
      const c = entryToComment(entry, editor);
      if (c) next.push(c);
    });
    next.sort((a, b) => a.fromOffset - b.fromOffset);
    this.snapshot = next;
  }

  private async mirrorEvents(
    events: Y.YEvent<Y.AbstractType<unknown>>[],
  ): Promise<void> {
    const mirror = this.opts.dexieMirror;
    if (!mirror) return;
    const upserts = new Set<string>();
    const removals = new Set<string>();
    for (const event of events) {
      if (event.target === this.byId) {
        for (const [key, change] of event.changes.keys) {
          if (change.action === "delete") {
            removals.add(key);
          } else {
            upserts.add(key);
          }
        }
      } else if (event.target instanceof Y.Map) {
        // Inner Y.Map (a comment entry) changed; we know the id from the path.
        const path = event.path;
        if (path.length > 0 && typeof path[0] === "string") {
          upserts.add(path[0]);
        }
      }
    }
    for (const id of removals) {
      await mirror.remove(id);
    }
    for (const id of upserts) {
      const entry = this.byId.get(id);
      if (!entry) continue;
      const c = entryToComment(entry, this.currentEditor);
      if (c) await mirror.upsert(c);
    }
  }
}

// Suppress unused-import warning for REMOTE_ORIGIN — we don't filter on it
// inside the adapter today (we use transaction.origin === this), but we
// re-export it so callers wiring hostâ†”Dexie mirrors at a higher level
// can compose against the same sentinel.
void REMOTE_ORIGIN;
