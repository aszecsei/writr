import type { Editor } from "@tiptap/react";
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { base64urlToBytes, bytesToBase64url } from "./crypto";

/**
 * Helpers around y-prosemirror's relative-position machinery.
 *
 * `@tiptap/y-tiptap` is the prosemirror binding that ships with TipTap's
 * Collaboration extension. The relative-position helpers translate between
 * absolute ProseMirror offsets and Yjs `RelativePosition`s (which survive
 * concurrent edits across peers). We import them directly because TipTap
 * itself does the same internally — the package is a stable, public peer.
 */

type YState = {
  doc: Y.Doc;
  type: Y.XmlFragment;
  binding: { mapping: Map<unknown, unknown> };
};

function getYState(editor: Editor): YState | null {
  const state = editor.state;
  // ySyncPluginKey state is added by the Yjs sync plugin. When the editor
  // isn't running collab, this is null and the helpers below short-circuit.
  const ystate = ySyncPluginKey.getState(state) as YState | null | undefined;
  if (!ystate?.binding) return null;
  return ystate;
}

/**
 * Encode a current PM offset as a transport-safe relative position
 * (base64). Returns null if the editor isn't running collab.
 */
export function encodeRelativeFromAbsolute(
  editor: Editor,
  absolute: number,
): string | null {
  const ystate = getYState(editor);
  if (!ystate) return null;
  const rel = absolutePositionToRelativePosition(
    absolute,
    ystate.type,
    ystate.binding.mapping as never,
  );
  if (!rel) return null;
  const buf = Y.encodeRelativePosition(rel);
  return bytesToBase64url(buf);
}

/**
 * Resolve a previously-encoded relative position to a current absolute
 * PM offset. Returns null when the relative position no longer maps to
 * a live position (e.g. the anchor item was deleted).
 */
export function resolveAbsoluteFromRelative(
  editor: Editor,
  encoded: string,
): number | null {
  const ystate = getYState(editor);
  if (!ystate) return null;
  let rel: Y.RelativePosition;
  try {
    rel = Y.decodeRelativePosition(base64urlToBytes(encoded));
  } catch {
    return null;
  }
  const absolute = relativePositionToAbsolutePosition(
    ystate.doc,
    ystate.type,
    rel,
    ystate.binding.mapping as never,
  );
  return typeof absolute === "number" ? absolute : null;
}
