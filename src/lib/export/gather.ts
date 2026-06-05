import { getBinderItems, getProject } from "@/db/operations";
import type { Chapter } from "@/db/schemas";
import {
  type FlatBinderNode,
  flattenManuscript,
  subtreeIds,
} from "@/lib/binder/tree";
import type { ExportContent, ExportItem, ExportOptions } from "./types";

/** Map a flattened manuscript node to an export item, or `null` to omit it. */
function toExportItem(
  node: FlatBinderNode,
  baseDepth: number,
): ExportItem | null {
  const { chapter, depth } = node;
  const level = Math.max(0, depth - baseDepth);
  if (chapter.kind === "separator") {
    if (!chapter.includeInCompile) return null;
    return {
      title: chapter.title,
      content: "",
      level,
      isSeparator: true,
      pageBreakBefore: chapter.pageBreakBefore,
    };
  }
  return { title: chapter.title, content: chapter.content, level };
}

export async function gatherContent(
  options: ExportOptions,
): Promise<ExportContent> {
  const project = await getProject(options.projectId);
  if (!project) throw new Error("Project not found");

  // Every binder row; flattenManuscript keeps manuscript-section rows in
  // depth-first order (parent before children) and drops scratchpad.
  const items: Chapter[] = await getBinderItems(options.projectId);
  const flat = flattenManuscript(items);

  if (options.scope === "chapter" && options.chapterId) {
    const subtree = subtreeIds(items, options.chapterId);
    const inSubtree = flat.filter((n) => subtree.has(n.chapter.id));
    if (inSubtree.length === 0) throw new Error("Chapter not found");
    const baseDepth = inSubtree[0].depth;
    return {
      projectTitle: project.title,
      chapters: inSubtree
        .map((n) => toExportItem(n, baseDepth))
        .filter((item): item is ExportItem => item !== null),
    };
  }

  return {
    projectTitle: project.title,
    chapters: flat
      .map((n) => toExportItem(n, 0))
      .filter((item): item is ExportItem => item !== null),
  };
}
