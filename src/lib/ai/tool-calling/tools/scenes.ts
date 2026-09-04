import { z } from "zod";
import { getChapter } from "@/db/operations/chapters";
import { getCharactersByProject } from "@/db/operations/characters";
import { getLocationsByProject } from "@/db/operations/locations";
import {
  getScene,
  getScenesByChapter,
  updateScene,
} from "@/db/operations/scenes";
import {
  type ChapterId,
  ChapterStatusEnum,
  type Scene,
  type SceneId,
  TimelineModeEnum,
} from "@/db/schemas";
import { buildNameMap } from "@/lib/ai/serialize";
import { defineTool } from "../types";
import { fail, ok } from "./helpers";

// Scene-level metadata read/write. A Scene row holds identity, ordering, and
// metadata only — never prose (that lives in the chapter's single TipTap
// document, delimited by `sceneBreak` markers). `list_scenes` surfaces a
// chapter's scenes with character/location ids resolved to names; `update_scene`
// writes the author-editable metadata fields (never `order`, which the
// marker↔row sync engine owns).

/** Resolve a list of ids to `{ id, name }` pairs, dropping ids with no row. */
function resolveNamed(
  ids: readonly string[],
  nameMap: Map<string, string>,
): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const id of ids) {
    const name = nameMap.get(id);
    if (name !== undefined) out.push({ id, name });
  }
  return out;
}

function serializeScene(
  scene: Scene,
  charMap: Map<string, string>,
  locMap: Map<string, string>,
): Record<string, unknown> {
  return {
    id: scene.id,
    order: scene.order,
    title: scene.title,
    status: scene.status,
    wordCount: scene.wordCount,
    targetWordCount: scene.targetWordCount,
    timelineMode: scene.timelineMode,
    storyDate: scene.storyDate,
    storyTime: scene.storyTime,
    strands: scene.strands,
    tags: scene.tags,
    povCharacter: scene.povCharacterId
      ? {
          id: scene.povCharacterId,
          name: charMap.get(scene.povCharacterId) ?? null,
        }
      : null,
    presentCharacters: resolveNamed(scene.presentCharacterIds, charMap),
    locations: resolveNamed(scene.locationIds, locMap),
  };
}

export const listScenesTool = defineTool({
  id: "list_scenes",
  name: "List Scenes",
  description:
    "List a chapter's scenes in order with their metadata (title, status, POV, " +
    "present characters, locations, timeline mode, story date/time, strands, " +
    "tags, word counts). Scene 0 is the implicit 'core' scene — the prose before " +
    "the first scene break. Character and location references are resolved to " +
    "names. Use the returned scene ids with `update_scene`.",
  inputSchema: z.object({
    chapterId: z.string().min(1).describe("Chapter ID whose scenes to list."),
  }),
  requiresApproval: false,
  async execute(params, context) {
    const chapter = await getChapter(params.chapterId as ChapterId);
    if (!chapter) return fail(`Chapter not found: ${params.chapterId}`);
    if (chapter.projectId !== context.projectId)
      return fail("Chapter belongs to a different project");

    const [scenes, characters, locations] = await Promise.all([
      getScenesByChapter(params.chapterId as ChapterId),
      getCharactersByProject(context.projectId),
      getLocationsByProject(context.projectId),
    ]);
    const charMap = buildNameMap(characters, (c) => c.name);
    const locMap = buildNameMap(locations, (l) => l.name);

    return ok(`Chapter "${chapter.title}": ${scenes.length} scene(s)`, {
      chapterId: chapter.id,
      title: chapter.title,
      scenes: scenes.map((s) => serializeScene(s, charMap, locMap)),
    });
  },
});

export const updateSceneTool = defineTool({
  id: "update_scene",
  name: "Update Scene",
  description:
    "Update a scene's metadata. Only include fields to change. Use `list_scenes` " +
    "first to discover scene ids and the valid character/location ids. Pass " +
    "`povCharacterId: null` to clear the POV. Character and location ids must " +
    "belong to the same project. Scene ordering is managed by the editor and " +
    "cannot be set here.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Scene ID"),
    title: z.string().describe("New scene title").optional(),
    status: ChapterStatusEnum.describe("New status").optional(),
    povCharacterId: z
      .string()
      .min(1)
      .describe("Point-of-view character id, or null to clear")
      .nullable()
      .optional(),
    presentCharacterIds: z
      .array(z.string().min(1))
      .describe("Ids of characters present in the scene")
      .optional(),
    locationIds: z
      .array(z.string().min(1))
      .describe("Ids of locations the scene takes place in")
      .optional(),
    timelineMode: TimelineModeEnum.describe(
      "How the scene sits on the timeline",
    ).optional(),
    strands: z
      .array(z.string())
      .describe("Free-text storyline threads (e.g. a subplot or year)")
      .optional(),
    storyDate: z.string().describe("In-world date the scene occurs").optional(),
    storyTime: z
      .string()
      .describe("In-world time of day the scene occurs")
      .optional(),
    targetWordCount: z
      .number()
      .int()
      .nonnegative()
      .describe("Target word count for the scene")
      .optional(),
    tags: z
      .array(z.string())
      .describe("Nestable tags (e.g. 'arc/rising-action')")
      .optional(),
  }),
  requiresApproval: true,
  async execute(params, context) {
    const { id, ...fields } = params;
    const scene = await getScene(id as SceneId);
    if (!scene) return fail(`Scene not found: ${id}`);
    if (scene.projectId !== context.projectId)
      return fail("Scene belongs to a different project");

    // Validate referenced ids against the project so a scene never points at a
    // character or location that doesn't exist (the sidebar picker guarantees
    // this for human edits; the model has no such guardrail).
    const referencedCharacterIds = [
      ...(fields.povCharacterId ? [fields.povCharacterId] : []),
      ...(fields.presentCharacterIds ?? []),
    ];
    if (referencedCharacterIds.length > 0) {
      const known = new Set<string>(
        (await getCharactersByProject(context.projectId)).map((c) => c.id),
      );
      const missing = referencedCharacterIds.filter((cid) => !known.has(cid));
      if (missing.length > 0)
        return fail(`Unknown character id(s): ${missing.join(", ")}`);
    }
    if (fields.locationIds && fields.locationIds.length > 0) {
      const known = new Set<string>(
        (await getLocationsByProject(context.projectId)).map((l) => l.id),
      );
      const missing = fields.locationIds.filter((lid) => !known.has(lid));
      if (missing.length > 0)
        return fail(`Unknown location id(s): ${missing.join(", ")}`);
    }

    // The db layer strips `undefined`, so an omitted field is a no-op (an
    // explicit `null` still clears `povCharacterId`). The cast only re-brands
    // the Zod-validated plain strings back to their id types.
    await updateScene(
      id as SceneId,
      fields as Parameters<typeof updateScene>[1],
    );
    return ok(
      `Updated scene ${scene.order} of chapter ${scene.chapterId}${
        scene.title ? ` ("${scene.title}")` : ""
      }`,
    );
  },
});
