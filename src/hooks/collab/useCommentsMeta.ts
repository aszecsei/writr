"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";
import type { ChapterId, ProjectId } from "@/db/schemas";

interface CommentsMeta {
  chapterId: ChapterId | null;
  projectId: ProjectId | null;
}

/**
 * Reads `chapterId` / `projectId` out of a comments Y.Doc's meta map and
 * keeps them in React state. The host writes meta on session start, so
 * guests pick the values up via the same Yjs sync that streams prose.
 */
export function useCommentsMeta(doc: Y.Doc | null): CommentsMeta {
  const [meta, setMeta] = useState<CommentsMeta>({
    chapterId: null,
    projectId: null,
  });

  useEffect(() => {
    if (!doc) {
      setMeta({ chapterId: null, projectId: null });
      return;
    }
    const map = doc.getMap("meta");
    const read = () => {
      const chapterId = map.get("chapterId");
      const projectId = map.get("projectId");
      setMeta({
        chapterId:
          typeof chapterId === "string" ? (chapterId as ChapterId) : null,
        projectId:
          typeof projectId === "string" ? (projectId as ProjectId) : null,
      });
    };
    read();
    map.observe(read);
    return () => {
      map.unobserve(read);
    };
  }, [doc]);

  return meta;
}
