import { z } from "zod";
import { searchProjectPaginated } from "@/lib/search/search";
import { defineTool } from "../types";
import { ok } from "./helpers";

const SearchableEntityTypeEnum = z.enum([
  "chapter",
  "character",
  "location",
  "timelineEvent",
  "styleGuideEntry",
  "worldbuildingDoc",
  "outlineCell",
]);

export const searchProjectTool = defineTool({
  id: "search_project",
  category: "search",
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
});
