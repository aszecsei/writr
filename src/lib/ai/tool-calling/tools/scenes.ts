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
  type CharacterId,
  type LocationId,
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
  category: "scene",
  name: "List Scenes",
  description:
    "List a chapter's scenes in order with their metadata (title, status, POV, " +
    "present characters, locations, timeline mode, story date/time, strands, " +
    "tags, word counts). Scene 0 is the implicit 'core' scene — the prose before " +
    "the first scene break. Character and location references are resolved to " +
    "names. Use the returned scene ids with `update_scene`.",
  parameters: {
    type: "object",
    properties: {
      chapterId: {
        type: "string",
        description: "Chapter ID whose scenes to list.",
      },
    },
    required: ["chapterId"],
  },
  inputSchema: z.object({ chapterId: z.string().min(1) }).strip(),
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
  category: "scene",
  name: "Update Scene",
  description:
    "Update a scene's metadata. Only include fields to change. Use `list_scenes` " +
    "first to discover scene ids and the valid character/location ids. Pass " +
    "`povCharacterId: null` to clear the POV. Character and location ids must " +
    "belong to the same project. Scene ordering is managed by the editor and " +
    "cannot be set here.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Scene ID" },
      title: { type: "string", description: "New scene title" },
      status: {
        type: "string",
        description: "New status",
        enum: ["draft", "revised", "final"],
      },
      povCharacterId: {
        type: "string",
        description: "Point-of-view character id, or null to clear",
      },
      presentCharacterIds: {
        type: "array",
        description: "Ids of characters present in the scene",
        items: { type: "string" },
      },
      locationIds: {
        type: "array",
        description: "Ids of locations the scene takes place in",
        items: { type: "string" },
      },
      timelineMode: {
        type: "string",
        description: "How the scene sits on the timeline",
        enum: [
          "linear",
          "flashback",
          "flashforward",
          "dream",
          "vision",
          "other",
        ],
      },
      strands: {
        type: "array",
        description: "Free-text storyline threads (e.g. a subplot or year)",
        items: { type: "string" },
      },
      storyDate: {
        type: "string",
        description: "In-world date the scene occurs",
      },
      storyTime: {
        type: "string",
        description: "In-world time of day the scene occurs",
      },
      targetWordCount: {
        type: "number",
        description: "Target word count for the scene",
      },
      tags: {
        type: "array",
        description: "Nestable tags (e.g. 'arc/rising-action')",
        items: { type: "string" },
      },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      status: ChapterStatusEnum.optional(),
      povCharacterId: z.string().min(1).nullable().optional(),
      presentCharacterIds: z.array(z.string().min(1)).optional(),
      locationIds: z.array(z.string().min(1)).optional(),
      timelineMode: TimelineModeEnum.optional(),
      strands: z.array(z.string()).optional(),
      storyDate: z.string().optional(),
      storyTime: z.string().optional(),
      targetWordCount: z.number().int().nonnegative().optional(),
      tags: z.array(z.string()).optional(),
    })
    .strip(),
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

    await updateScene(id as SceneId, {
      ...fields,
      povCharacterId: fields.povCharacterId as CharacterId | null | undefined,
      presentCharacterIds: fields.presentCharacterIds as
        | CharacterId[]
        | undefined,
      locationIds: fields.locationIds as LocationId[] | undefined,
    });
    return ok(
      `Updated scene ${scene.order} of chapter ${scene.chapterId}${
        scene.title ? ` ("${scene.title}")` : ""
      }`,
    );
  },
});
