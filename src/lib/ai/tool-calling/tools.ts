import { z } from "zod";
import {
  createChapter,
  getChapter,
  getChaptersByProject,
  updateChapter,
} from "@/db/operations/chapters";
import {
  createCharacter,
  getCharacter,
  getCharactersByProject,
  updateCharacter,
} from "@/db/operations/characters";
import {
  createLocation,
  getLocation,
  getLocationsByProject,
  updateLocation,
} from "@/db/operations/locations";
import {
  getOutlineGridCellsByProject,
  getOutlineGridColumnsByProject,
  getOutlineGridRowsByProject,
} from "@/db/operations/outline";
import {
  getStyleGuideByProject,
  getStyleGuideEntry,
} from "@/db/operations/style-guide";
import {
  createTimelineEvent,
  getTimelineByProject,
  getTimelineEvent,
  updateTimelineEvent,
} from "@/db/operations/timeline";
import {
  getWorldbuildingDoc,
  getWorldbuildingDocsByProject,
} from "@/db/operations/worldbuilding";
import { ChapterStatusEnum, CharacterRoleEnum } from "@/db/schemas";
import { buildNameMap, serializeOutlineGrid } from "@/lib/ai/serialize";
import { extractSnippet, textContainsQuery } from "@/lib/search/highlight";
import { searchProjectPaginated } from "@/lib/search/search";
import type {
  AiToolDefinition,
  ToolDefinitionForModel,
  ToolExecutionContext,
  ToolResult,
} from "./types";

// ─── Helper ─────────────────────────────────────────────────────────

function splitParagraphs(content: string): string[] {
  return content.split(/\n\n+/).filter((p) => p.trim());
}

const SCENE_BREAK_RE = /^[-*]{3,}$|^\*\s\*\s\*$/;

function ok(message: string, data?: Record<string, unknown>): ToolResult {
  return { success: true, message, data };
}

function fail(message: string): ToolResult {
  return { success: false, message };
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) =>
      i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
    )
    .join("; ");
}

// ─── Character Tools ────────────────────────────────────────────────

const createCharacterTool: AiToolDefinition = {
  id: "create_character",
  name: "Create Character",
  description:
    "Create a new character in the story bible. Use when the user asks to add a character.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Character name" },
      role: {
        type: "string",
        description: "Character role",
        enum: ["protagonist", "antagonist", "supporting", "minor"],
      },
      description: { type: "string", description: "Brief description" },
      personality: { type: "string", description: "Personality traits" },
      backstory: { type: "string", description: "Character backstory" },
    },
    required: ["name"],
  },
  inputSchema: z
    .object({
      name: z.string().min(1),
      role: CharacterRoleEnum.optional(),
      description: z.string().optional(),
      personality: z.string().optional(),
      backstory: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const character = await createCharacter({
      projectId: context.projectId,
      name: params.name,
      role: params.role ?? undefined,
      description: params.description ?? undefined,
      personality: params.personality ?? undefined,
      backstory: params.backstory ?? undefined,
    });
    return ok(`Created character "${character.name}"`, {
      id: character.id,
      name: character.name,
    });
  },
};

const getCharacterTool: AiToolDefinition = {
  id: "get_character",
  name: "Get Character",
  description:
    "Look up a character by ID. Use after list_characters to get full details.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Character ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params) {
    const character = await getCharacter(params.id);
    if (!character) return fail(`Character not found: ${params.id}`);
    return ok(`Found character "${character.name}"`, {
      id: character.id,
      name: character.name,
      role: character.role,
      pronouns: character.pronouns,
      description: character.description,
      personality: character.personality,
      motivations: character.motivations,
      backstory: character.backstory,
      strengths: character.strengths,
      weaknesses: character.weaknesses,
      dialogueStyle: character.dialogueStyle,
      aliases: character.aliases,
    });
  },
};

const updateCharacterTool: AiToolDefinition = {
  id: "update_character",
  name: "Update Character",
  description:
    "Update fields on an existing character. Only include fields to change.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Character ID" },
      name: { type: "string", description: "New name" },
      role: {
        type: "string",
        description: "New role",
        enum: ["protagonist", "antagonist", "supporting", "minor"],
      },
      description: { type: "string", description: "New description" },
      personality: { type: "string", description: "New personality" },
      backstory: { type: "string", description: "New backstory" },
      motivations: { type: "string", description: "New motivations" },
      strengths: { type: "string", description: "New strengths" },
      weaknesses: { type: "string", description: "New weaknesses" },
      dialogueStyle: { type: "string", description: "New dialogue style" },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      name: z.string().optional(),
      role: CharacterRoleEnum.optional(),
      description: z.string().optional(),
      personality: z.string().optional(),
      backstory: z.string().optional(),
      motivations: z.string().optional(),
      strengths: z.string().optional(),
      weaknesses: z.string().optional(),
      dialogueStyle: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getCharacter(id);
    if (!existing) return fail(`Character not found: ${id}`);
    await updateCharacter(id, fields);
    return ok(`Updated character "${existing.name}"`);
  },
};

const listCharactersTool: AiToolDefinition = {
  id: "list_characters",
  name: "List Characters",
  description:
    "List all characters in the project with their names, IDs, and roles. " +
    "Use this to find character IDs before calling get_character or update_character.",
  parameters: {
    type: "object",
    properties: {},
  },
  inputSchema: z.object({}).strip(),
  requiresApproval: false,
  async execute(_params, context) {
    const characters = await getCharactersByProject(context.projectId);
    return ok(`Found ${characters.length} characters`, {
      characters: characters.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
      })),
    });
  },
};

// ─── Location Tools ─────────────────────────────────────────────────

const createLocationTool: AiToolDefinition = {
  id: "create_location",
  name: "Create Location",
  description:
    "Create a new location in the story bible. Use when the user asks to add a setting or place.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Location name" },
      description: { type: "string", description: "Location description" },
      notes: { type: "string", description: "Additional notes" },
    },
    required: ["name"],
  },
  inputSchema: z
    .object({
      name: z.string().min(1),
      description: z.string().optional(),
      notes: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const location = await createLocation({
      projectId: context.projectId,
      name: params.name,
      description: params.description ?? undefined,
      notes: params.notes ?? undefined,
    });
    return ok(`Created location "${location.name}"`, {
      id: location.id,
      name: location.name,
    });
  },
};

const getLocationTool: AiToolDefinition = {
  id: "get_location",
  name: "Get Location",
  description: "Look up a location by ID to get full details.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Location ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params) {
    const location = await getLocation(params.id);
    if (!location) return fail(`Location not found: ${params.id}`);
    return ok(`Found location "${location.name}"`, {
      id: location.id,
      name: location.name,
      description: location.description,
      notes: location.notes,
    });
  },
};

const updateLocationTool: AiToolDefinition = {
  id: "update_location",
  name: "Update Location",
  description:
    "Update fields on an existing location. Only include fields to change.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Location ID" },
      name: { type: "string", description: "New name" },
      description: { type: "string", description: "New description" },
      notes: { type: "string", description: "New notes" },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      name: z.string().optional(),
      description: z.string().optional(),
      notes: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getLocation(id);
    if (!existing) return fail(`Location not found: ${id}`);
    await updateLocation(id, fields);
    return ok(`Updated location "${existing.name}"`);
  },
};

// ─── Timeline Event Tools ───────────────────────────────────────────

const createTimelineEventTool: AiToolDefinition = {
  id: "create_timeline_event",
  name: "Create Timeline Event",
  description:
    "Add a timeline event. Use when the user asks to add events or plot points.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Event title" },
      description: { type: "string", description: "Event description" },
      date: {
        type: "string",
        description: "In-story date (freeform string)",
      },
    },
    required: ["title"],
  },
  inputSchema: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      date: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const event = await createTimelineEvent({
      projectId: context.projectId,
      title: params.title,
      description: params.description ?? undefined,
      date: params.date ?? undefined,
    });
    return ok(`Created timeline event "${event.title}"`, {
      id: event.id,
      title: event.title,
    });
  },
};

const getTimelineEventTool: AiToolDefinition = {
  id: "get_timeline_event",
  name: "Get Timeline Event",
  description: "Look up a timeline event by ID to get full details.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Timeline event ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params) {
    const event = await getTimelineEvent(params.id);
    if (!event) return fail(`Timeline event not found: ${params.id}`);
    return ok(`Found event "${event.title}"`, {
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
    });
  },
};

const updateTimelineEventTool: AiToolDefinition = {
  id: "update_timeline_event",
  name: "Update Timeline Event",
  description:
    "Update fields on an existing timeline event. Only include fields to change.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Timeline event ID" },
      title: { type: "string", description: "New title" },
      description: { type: "string", description: "New description" },
      date: { type: "string", description: "New date" },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      description: z.string().optional(),
      date: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getTimelineEvent(id);
    if (!existing) return fail(`Timeline event not found: ${id}`);
    await updateTimelineEvent(id, fields);
    return ok(`Updated event "${existing.title}"`);
  },
};

// ─── Chapter Tools ──────────────────────────────────────────────────

const createChapterTool: AiToolDefinition = {
  id: "create_chapter",
  name: "Create Chapter",
  description:
    "Create a new chapter. Use when the user asks to add a chapter to the project.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Chapter title" },
      synopsis: { type: "string", description: "Brief chapter synopsis" },
    },
    required: ["title"],
  },
  inputSchema: z
    .object({
      title: z.string().min(1),
      synopsis: z.string().optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params, context) {
    const chapter = await createChapter({
      projectId: context.projectId,
      title: params.title,
      synopsis: params.synopsis ?? undefined,
    });
    return ok(`Created chapter "${chapter.title}"`, {
      id: chapter.id,
      title: chapter.title,
    });
  },
};

const getChapterTool: AiToolDefinition = {
  id: "get_chapter",
  name: "Get Chapter",
  description:
    "Look up a chapter by ID to get its title, synopsis, status, totalParagraphs, and hasSceneBreaks. " +
    "Use totalParagraphs and hasSceneBreaks to decide which partial retrieval tool to use.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params) {
    const chapter = await getChapter(params.id);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    const paragraphs = splitParagraphs(chapter.content);
    const hasSceneBreaks = paragraphs.some((p) => SCENE_BREAK_RE.test(p));
    return ok(`Found chapter "${chapter.title}"`, {
      id: chapter.id,
      title: chapter.title,
      synopsis: chapter.synopsis,
      status: chapter.status,
      wordCount: chapter.wordCount,
      totalParagraphs: paragraphs.length,
      hasSceneBreaks,
    });
  },
};

const updateChapterTool: AiToolDefinition = {
  id: "update_chapter",
  name: "Update Chapter",
  description:
    "Update a chapter's title, synopsis, or status. Only include fields to change.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
      title: { type: "string", description: "New title" },
      synopsis: { type: "string", description: "New synopsis" },
      status: {
        type: "string",
        description: "New status",
        enum: ["draft", "revised", "final"],
      },
    },
    required: ["id"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      synopsis: z.string().optional(),
      status: ChapterStatusEnum.optional(),
    })
    .strip(),
  requiresApproval: true,
  async execute(params) {
    const { id, ...fields } = params;
    const existing = await getChapter(id);
    if (!existing) return fail(`Chapter not found: ${id}`);
    await updateChapter(id, fields);
    return ok(`Updated chapter "${existing.title}"`);
  },
};

const searchChaptersTool: AiToolDefinition = {
  id: "search_chapters",
  name: "Search Chapters",
  description:
    "Search chapter content by a phrase or keyword. Returns matching chapter titles, IDs, and snippets.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search phrase" },
    },
    required: ["query"],
  },
  inputSchema: z.object({ query: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params, context) {
    const query = params.query;
    const chapters = await getChaptersByProject(context.projectId);
    const matches = chapters
      .filter(
        (ch) =>
          textContainsQuery(ch.title, query) ||
          textContainsQuery(ch.content, query),
      )
      .map((ch) => ({
        id: ch.id,
        title: ch.title,
        snippet: extractSnippet(ch.content, query),
      }));
    return ok(`Found ${matches.length} matching chapters`, { matches });
  },
};

// ─── Search Tools ────────────────────────────────────────────────────

const SearchableEntityTypeEnum = z.enum([
  "chapter",
  "character",
  "location",
  "timelineEvent",
  "styleGuideEntry",
  "worldbuildingDoc",
  "outlineCell",
]);

const searchProjectTool: AiToolDefinition = {
  id: "search_project",
  name: "Search Project",
  description:
    "Search across the entire project for a keyword or phrase. " +
    "Returns matches from chapters, characters, locations, timeline events, " +
    "style guide, worldbuilding docs, and outline cells. " +
    "Each result includes the entity type, title, matching field, and a text snippet. " +
    "Use this for broad discovery before drilling into specific entities with get_* tools.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search phrase or keyword" },
      entity_types: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "chapter",
            "character",
            "location",
            "timelineEvent",
            "styleGuideEntry",
            "worldbuildingDoc",
            "outlineCell",
          ],
        },
        description: "Optional filter to search only specific entity types",
      },
    },
    required: ["query"],
  },
  inputSchema: z
    .object({
      query: z.string().min(1),
      entity_types: z.array(SearchableEntityTypeEnum).optional(),
    })
    .strip(),
  requiresApproval: false,
  async execute(params, context) {
    const result = await searchProjectPaginated(
      context.projectId,
      params.query,
      1,
      20,
      params.entity_types,
    );
    return ok(`Found ${result.totalCount} results for "${params.query}"`, {
      results: result.results.map((r) => ({
        id: r.id,
        entityType: r.entityType,
        title: r.title,
        subtitle: r.subtitle,
        snippet: r.snippet,
        matchField: r.matchField,
      })),
      totalCount: result.totalCount,
    });
  },
};

// ─── List/Read Tools (agentic discovery) ────────────────────────────

const listChaptersTool: AiToolDefinition = {
  id: "list_chapters",
  name: "List Chapters",
  description:
    "List all chapters in the project with their titles, IDs, statuses, and word counts. " +
    "Use this to discover chapter IDs before calling get_chapter or read_chapter.",
  parameters: {
    type: "object",
    properties: {},
  },
  inputSchema: z.object({}).strip(),
  requiresApproval: false,
  async execute(_params, context) {
    const chapters = await getChaptersByProject(context.projectId);
    return ok(`Found ${chapters.length} chapters`, {
      chapters: chapters.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        wordCount: c.wordCount,
      })),
    });
  },
};

const readChapterTool: AiToolDefinition = {
  id: "read_chapter",
  name: "Read Chapter",
  description:
    "Read the full markdown content of a chapter by ID. " +
    "For large chapters, prefer read_chapter_range or search_chapter to reduce token usage.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params) {
    const chapter = await getChapter(params.id);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    return ok(`Chapter "${chapter.title}" (${chapter.wordCount} words)`, {
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
    });
  },
};

const readChapterRangeTool: AiToolDefinition = {
  id: "read_chapter_range",
  name: "Read Chapter Range",
  description:
    "Read a range of paragraphs from a chapter (1-indexed, inclusive). " +
    "Default window is 20 paragraphs, max 50. Use after get_chapter to read specific sections.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
      start: {
        type: "number",
        description: "Start paragraph number (1-indexed)",
      },
      end: {
        type: "number",
        description:
          "End paragraph number (1-indexed, inclusive). Defaults to start + 19.",
      },
    },
    required: ["id", "start"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      start: z.number().int().min(1),
      end: z.number().int().min(1).optional(),
    })
    .strip(),
  requiresApproval: false,
  async execute(params) {
    const chapter = await getChapter(params.id);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    const paragraphs = splitParagraphs(chapter.content);
    const total = paragraphs.length;
    const start = Math.max(1, Math.min(params.start, total));
    const rawEnd = params.end ?? start + 19;
    const end = Math.max(start, Math.min(rawEnd, total, start + 49));
    const content = paragraphs.slice(start - 1, end).join("\n\n");
    return ok(
      `Chapter "${chapter.title}" paragraphs ${start}-${end} of ${total}`,
      {
        id: chapter.id,
        title: chapter.title,
        content,
        start,
        end,
        totalParagraphs: total,
      },
    );
  },
};

const searchChapterTool: AiToolDefinition = {
  id: "search_chapter",
  name: "Search Chapter",
  description:
    "Search within a single chapter by keyword. Returns matching paragraph numbers with surrounding context. " +
    "Use this instead of read_chapter when looking for a specific passage.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
      query: { type: "string", description: "Search keyword or phrase" },
      context_paragraphs: {
        type: "number",
        description:
          "Number of surrounding paragraphs to include (default 1, max 3)",
      },
    },
    required: ["id", "query"],
  },
  inputSchema: z
    .object({
      id: z.string().min(1),
      query: z.string().min(1),
      context_paragraphs: z.number().int().min(0).max(3).optional(),
    })
    .strip(),
  requiresApproval: false,
  async execute(params) {
    const chapter = await getChapter(params.id);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    const paragraphs = splitParagraphs(chapter.content);
    const ctxSize = params.context_paragraphs ?? 1;
    const queryLower = params.query.toLowerCase();
    const matches: { paragraph: number; snippet: string }[] = [];
    for (let i = 0; i < paragraphs.length && matches.length < 10; i++) {
      if (paragraphs[i].toLowerCase().includes(queryLower)) {
        const from = Math.max(0, i - ctxSize);
        const to = Math.min(paragraphs.length - 1, i + ctxSize);
        const snippet = paragraphs.slice(from, to + 1).join("\n\n");
        matches.push({ paragraph: i + 1, snippet });
      }
    }
    return ok(
      `Found ${matches.length} matches for "${params.query}" in "${chapter.title}"`,
      {
        id: chapter.id,
        title: chapter.title,
        matches,
        totalMatches: matches.length,
      },
    );
  },
};

const getChapterStructureTool: AiToolDefinition = {
  id: "get_chapter_structure",
  name: "Get Chapter Structure",
  description:
    "Get the structural map of a chapter: scene boundaries with paragraph numbers and previews. " +
    "Use this to understand chapter layout before reading specific sections.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Chapter ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params) {
    const chapter = await getChapter(params.id);
    if (!chapter) return fail(`Chapter not found: ${params.id}`);
    const paragraphs = splitParagraphs(chapter.content);
    const scenes: { start: number; end: number; preview: string }[] = [];
    let sceneStart = 1;
    for (let i = 0; i < paragraphs.length; i++) {
      if (SCENE_BREAK_RE.test(paragraphs[i])) {
        if (i > sceneStart - 1) {
          const firstPara = paragraphs[sceneStart - 1];
          scenes.push({
            start: sceneStart,
            end: i, // paragraph before the break
            preview: firstPara.slice(0, 80),
          });
        }
        sceneStart = i + 2; // skip the break paragraph
      }
    }
    // Final scene (or the only scene if no breaks)
    if (sceneStart <= paragraphs.length) {
      const firstPara = paragraphs[sceneStart - 1];
      scenes.push({
        start: sceneStart,
        end: paragraphs.length,
        preview: firstPara.slice(0, 80),
      });
    }
    return ok(
      `Chapter "${chapter.title}": ${scenes.length} scene(s), ${paragraphs.length} paragraphs`,
      {
        id: chapter.id,
        title: chapter.title,
        totalParagraphs: paragraphs.length,
        scenes,
      },
    );
  },
};

const listLocationsTool: AiToolDefinition = {
  id: "list_locations",
  name: "List Locations",
  description:
    "List all locations in the project with their names and IDs. " +
    "Use this to discover location IDs before calling get_location.",
  parameters: {
    type: "object",
    properties: {},
  },
  inputSchema: z.object({}).strip(),
  requiresApproval: false,
  async execute(_params, context) {
    const locations = await getLocationsByProject(context.projectId);
    return ok(`Found ${locations.length} locations`, {
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
      })),
    });
  },
};

const listTimelineEventsTool: AiToolDefinition = {
  id: "list_timeline_events",
  name: "List Timeline Events",
  description:
    "List all timeline events in the project with their titles, dates, and IDs. " +
    "Use this to discover event IDs before calling get_timeline_event.",
  parameters: {
    type: "object",
    properties: {},
  },
  inputSchema: z.object({}).strip(),
  requiresApproval: false,
  async execute(_params, context) {
    const events = await getTimelineByProject(context.projectId);
    return ok(`Found ${events.length} timeline events`, {
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
      })),
    });
  },
};

const listStyleGuideTool: AiToolDefinition = {
  id: "list_style_guide",
  name: "List Style Guide",
  description:
    "List all style guide entries in the project with their titles, categories, and IDs. " +
    "Use this to discover entry IDs before calling get_style_guide_entry.",
  parameters: {
    type: "object",
    properties: {},
  },
  inputSchema: z.object({}).strip(),
  requiresApproval: false,
  async execute(_params, context) {
    const entries = await getStyleGuideByProject(context.projectId);
    return ok(`Found ${entries.length} style guide entries`, {
      entries: entries.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
      })),
    });
  },
};

const getStyleGuideEntryTool: AiToolDefinition = {
  id: "get_style_guide_entry",
  name: "Get Style Guide Entry",
  description: "Look up a style guide entry by ID to get its full content.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Style guide entry ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params) {
    const entry = await getStyleGuideEntry(params.id);
    if (!entry) return fail(`Style guide entry not found: ${params.id}`);
    return ok(`Found style guide entry "${entry.title}"`, {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      content: entry.content,
    });
  },
};

const listWorldbuildingDocsTool: AiToolDefinition = {
  id: "list_worldbuilding_docs",
  name: "List Worldbuilding Docs",
  description:
    "List all worldbuilding documents in the project with their titles, tags, parent doc IDs, and IDs. " +
    "Use this to discover doc IDs before calling get_worldbuilding_doc.",
  parameters: {
    type: "object",
    properties: {},
  },
  inputSchema: z.object({}).strip(),
  requiresApproval: false,
  async execute(_params, context) {
    const docs = await getWorldbuildingDocsByProject(context.projectId);
    return ok(`Found ${docs.length} worldbuilding docs`, {
      docs: docs.map((d) => ({
        id: d.id,
        title: d.title,
        tags: d.tags,
        parentDocId: d.parentDocId,
      })),
    });
  },
};

const getWorldbuildingDocTool: AiToolDefinition = {
  id: "get_worldbuilding_doc",
  name: "Get Worldbuilding Doc",
  description:
    "Look up a worldbuilding document by ID to get its full content.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "Worldbuilding doc ID" },
    },
    required: ["id"],
  },
  inputSchema: z.object({ id: z.string().min(1) }).strip(),
  requiresApproval: false,
  async execute(params) {
    const doc = await getWorldbuildingDoc(params.id);
    if (!doc) return fail(`Worldbuilding doc not found: ${params.id}`);
    return ok(`Found worldbuilding doc "${doc.title}"`, {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      tags: doc.tags,
      parentDocId: doc.parentDocId,
    });
  },
};

const getOutlineTool: AiToolDefinition = {
  id: "get_outline",
  name: "Get Outline",
  description:
    "Get the full outline grid for the project, including columns, rows, and cell contents.",
  parameters: {
    type: "object",
    properties: {},
  },
  inputSchema: z.object({}).strip(),
  requiresApproval: false,
  async execute(_params, context) {
    const [columns, rows, cells, chapters] = await Promise.all([
      getOutlineGridColumnsByProject(context.projectId),
      getOutlineGridRowsByProject(context.projectId),
      getOutlineGridCellsByProject(context.projectId),
      getChaptersByProject(context.projectId),
    ]);
    if (columns.length === 0) {
      return ok("No outline grid configured for this project.");
    }
    const chapterMap = buildNameMap(chapters, (c) => c.title);
    const serialized = serializeOutlineGrid(columns, rows, cells, chapterMap);
    return ok(`Outline: ${columns.length} columns, ${rows.length} rows`, {
      outline: serialized,
    });
  },
};

// ─── Registry ───────────────────────────────────────────────────────

export const AI_TOOLS: AiToolDefinition[] = [
  createCharacterTool,
  getCharacterTool,
  updateCharacterTool,
  listCharactersTool,
  createLocationTool,
  getLocationTool,
  updateLocationTool,
  listLocationsTool,
  createTimelineEventTool,
  getTimelineEventTool,
  updateTimelineEventTool,
  listTimelineEventsTool,
  createChapterTool,
  getChapterTool,
  updateChapterTool,
  searchChaptersTool,
  searchProjectTool,
  listChaptersTool,
  readChapterTool,
  readChapterRangeTool,
  searchChapterTool,
  getChapterStructureTool,
  listStyleGuideTool,
  getStyleGuideEntryTool,
  listWorldbuildingDocsTool,
  getWorldbuildingDocTool,
  getOutlineTool,
];

export const AI_TOOL_MAP = new Map<string, AiToolDefinition>(
  AI_TOOLS.map((t) => [t.id, t]),
);

export function getToolDefinitionsForModel(): ToolDefinitionForModel[] {
  return AI_TOOLS.map(({ id, name, description, parameters }) => ({
    id,
    name,
    description,
    parameters,
  }));
}

export async function executeTool(
  toolId: string,
  params: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const tool = AI_TOOL_MAP.get(toolId);
  if (!tool) return fail(`Unknown tool: ${toolId}`);

  const parsed = tool.inputSchema.safeParse(params);
  if (!parsed.success)
    return fail(`Invalid parameters: ${formatZodError(parsed.error)}`);

  try {
    return await tool.execute(parsed.data, context);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Tool execution failed",
    );
  }
}
