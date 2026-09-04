import { z } from "zod";
import { searchProjectKeywordPaginated } from "@/lib/search/keyword/search";
import { defineTool } from "../types";
import { ok } from "./helpers";

const SearchableEntityTypeEnum = z.enum([
  "chapter",
  "character",
  "location",
  "timelineEvent",
  "styleGuideEntry",
  "guardrailEntry",
  "worldbuildingDoc",
  "outlineCell",
]);

export const searchProjectTool = defineTool({
  id: "search_project",
  category: "search",
  name: "Search Project",
  description:
    "Tokenized keyword search across the project (BM25-ranked). " +
    "Throw multiple relevant keywords; documents matching ANY term are " +
    "returned, ranked by relevance. Prefix matches and small typos are " +
    'tolerated. Wrap text in double quotes (e.g. "moonlit garden") to ' +
    "require an exact phrase. " +
    "Returns matches from chapters, characters, locations, timeline events, " +
    "style guide, guardrails, worldbuilding docs, and outline cells. " +
    "Each result includes the entity type, title, matching field, and a text snippet. " +
    "Use this for broad discovery before drilling into specific entities with the `get` tool.",
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
            "guardrailEntry",
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
    const result = await searchProjectKeywordPaginated(
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
