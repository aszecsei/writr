// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { db } from "@/db/database";
import { readProjectMeta } from "@/lib/collab/projectDoc";
import type { DocKind } from "@/lib/collab/protocol";
import type { CollabSession } from "@/lib/collab/session";
import { useCollabStore } from "@/store/collabStore";
import { useEditorStore } from "@/store/editorStore";
import { makeChapter, makeProject, resetIdCounter } from "@/test/helpers";
import { HostProjectMirror } from "./HostProjectMirror";

function makeFakeSession(doc: Y.Doc): CollabSession {
  return {
    getDoc: (_docKind: DocKind) => doc,
  } as unknown as CollabSession;
}

beforeEach(async () => {
  await db.projects.clear();
  await db.chapters.clear();
  resetIdCounter();
  useCollabStore.getState().reset();
  useEditorStore.setState({
    activeDocumentId: null,
    activeDocumentType: null,
  });
});

afterEach(async () => {
  useCollabStore.getState().reset();
  useEditorStore.setState({
    activeDocumentId: null,
    activeDocumentType: null,
  });
  await db.projects.clear();
  await db.chapters.clear();
});

describe("HostProjectMirror", () => {
  it("mirrors the editorStore active chapter into the project doc meta", async () => {
    const project = makeProject({ title: "P" });
    await db.projects.add(project);
    const chapterOne = makeChapter({ projectId: project.id, title: "One" });
    const chapterTwo = makeChapter({ projectId: project.id, title: "Two" });
    await db.chapters.bulkAdd([chapterOne, chapterTwo]);

    const doc = new Y.Doc();
    const session = makeFakeSession(doc);

    useCollabStore.getState().setSession(session, {
      role: "host",
      peerId: "peer-1",
      hostPresent: true,
    });
    useCollabStore.getState().setProjectMode(true);

    useEditorStore.setState({
      activeDocumentId: chapterOne.id,
      activeDocumentType: "chapter",
    });

    render(<HostProjectMirror projectId={project.id} />);

    await waitFor(() => {
      expect(readProjectMeta(doc)?.activeChapterId).toBe(chapterOne.id);
    });

    useEditorStore.setState({
      activeDocumentId: chapterTwo.id,
      activeDocumentType: "chapter",
    });

    await waitFor(() => {
      expect(readProjectMeta(doc)?.activeChapterId).toBe(chapterTwo.id);
    });
  });

  it("mirrors null when the active document isn't a chapter", async () => {
    const project = makeProject({ title: "P" });
    await db.projects.add(project);

    const doc = new Y.Doc();
    const session = makeFakeSession(doc);

    useCollabStore.getState().setSession(session, {
      role: "host",
      peerId: "peer-1",
      hostPresent: true,
    });
    useCollabStore.getState().setProjectMode(true);

    render(<HostProjectMirror projectId={project.id} />);

    await waitFor(() => {
      expect(readProjectMeta(doc)).not.toBeNull();
    });
    expect(readProjectMeta(doc)?.activeChapterId).toBeNull();
  });
});
