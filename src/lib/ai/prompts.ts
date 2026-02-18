import {
  buildNameMap,
  serializeCharacter,
  serializeLocation,
  serializeOutlineGrid,
  serializeRelationship,
  serializeStyleGuideEntry,
  serializeTimelineEvent,
  serializeWorldbuildingTree,
} from "./serialize";
import type { AiContext, AiMessage, AiToolId, BuiltinAiTool } from "./types";

export const DEFAULT_SYSTEM_PROMPT = "You are a creative writing assistant.";

const SCREENPLAY_TOOL_INSTRUCTIONS: Partial<Record<BuiltinAiTool, string>> = {
  "generate-prose":
    "Continue writing in Fountain screenplay format. " +
    "Match the existing tone and style. Output only the new Fountain-formatted content, no commentary.",

  "character-dialogue":
    "Write dialogue in Fountain screenplay format for the specified characters that is consistent with their " +
    "established voices and personalities. Include character names (uppercase), parentheticals, and dialogue lines.",

  "suggest-edits":
    "Suggest concrete line edits to improve the selected screenplay text. " +
    "Format as a numbered list with the original text and your suggested replacement in Fountain format.",
};

function buildNovelContext(
  context: AiContext,
  options?: { excludeMinorCharacters?: boolean },
): string {
  const isScreenplay = context.projectMode === "screenplay";
  const rootTag = isScreenplay ? "screenplay" : "novel";
  const genreAttr = context.genre ? ` genre="${context.genre}"` : "";
  let novel = `<${rootTag} title="${context.projectTitle}"${genreAttr}>\n\n`;

  const charMap = buildNameMap(context.characters, (c) => c.name);

  const characters = options?.excludeMinorCharacters
    ? context.characters.filter((c) => c.role !== "minor")
    : context.characters;

  /** Append a tagged section if `items` is non-empty. */
  function addSection<T>(
    tag: string,
    items: T[],
    serialize: (item: T) => string,
  ) {
    if (items.length === 0) return;
    const lines = items.map(serialize).filter(Boolean);
    if (lines.length === 0) return;
    novel += `<${tag}>\n${lines.join("\n")}\n</${tag}>\n\n`;
  }

  addSection("characters", characters, serializeCharacter);
  addSection("relationships", context.relationships, (r) =>
    serializeRelationship(r, charMap),
  );
  addSection("locations", context.locations, (l) =>
    serializeLocation(l, charMap),
  );
  addSection("style-guide", context.styleGuide, serializeStyleGuideEntry);
  addSection("timeline", context.timelineEvents, (e) =>
    serializeTimelineEvent(e, charMap),
  );

  if (context.worldbuildingDocs.length > 0) {
    novel += "<worldbuilding>\n";
    novel += serializeWorldbuildingTree(context.worldbuildingDocs);
    novel += "\n</worldbuilding>\n\n";
  }

  if (context.outlineGridColumns.length > 0) {
    const chapterMap = buildNameMap(context.chapters, (c) => c.title);
    novel += "<outline>\n";
    novel += serializeOutlineGrid(
      context.outlineGridColumns,
      context.outlineGridRows,
      context.outlineGridCells,
      chapterMap,
    );
    novel += "\n</outline>\n\n";
  }

  novel += `</${rootTag}>`;
  return novel;
}

/**
 * Build a minimal, cache-stable context for agentic (tool-calling) mode.
 * Contains only project metadata and style guide — the AI fetches everything
 * else on demand via tools, saving tokens and improving cache hit rates.
 */
export function buildAgenticContext(context: AiContext): string {
  const isScreenplay = context.projectMode === "screenplay";
  const rootTag = isScreenplay ? "screenplay" : "novel";
  const genreAttr = context.genre ? ` genre="${context.genre}"` : "";
  let xml = `<${rootTag} title="${context.projectTitle}"${genreAttr}>\n\n`;

  if (context.projectDescription) {
    xml += `<description>${context.projectDescription}</description>\n\n`;
  }

  if (context.styleGuide.length > 0) {
    const lines = context.styleGuide
      .map(serializeStyleGuideEntry)
      .filter(Boolean);
    if (lines.length > 0) {
      xml += `<style-guide>\n${lines.join("\n")}\n</style-guide>\n\n`;
    }
  }

  xml += `</${rootTag}>`;
  return xml;
}

export const DEFAULT_TOOL_INSTRUCTIONS: Record<BuiltinAiTool, string> = {
  "generate-prose":
    "Continue writing prose in the style and voice of this novel. " +
    "Match the existing tone, tense, and POV. Output only the new prose, no commentary.",

  "review-text":
    "Review the provided text for: pacing, clarity, consistency with established " +
    "characters/setting, grammar, and style adherence. Provide specific, actionable feedback.",

  "suggest-edits":
    "Suggest concrete line edits to improve the selected text. " +
    "Format as a numbered list with the original text and your suggested replacement.",

  "character-dialogue":
    "Write dialogue for the specified characters that is consistent with their " +
    "established voices and personalities. Include minimal action beats.",

  brainstorm:
    "Brainstorm ideas related to the user's prompt. Offer 3-5 distinct options " +
    "with brief descriptions for each.",

  summarize:
    "Provide a concise summary of the provided text, capturing key plot points, " +
    "character developments, and thematic elements.",

  "consistency-check":
    "Analyze the story content for consistency issues. Check for:\n\n" +
    "## Plot Holes\n" +
    "- Events referenced but never established\n" +
    "- Unresolved plot threads or dangling setups\n" +
    "- Cause-and-effect gaps\n" +
    "- Contradictory facts about the world or events\n\n" +
    "## Timeline Contradictions\n" +
    "- Events occurring in impossible order\n" +
    "- Characters in two places at once\n" +
    "- Age/date inconsistencies\n" +
    "- Travel times that don't make sense\n\n" +
    "## Character Inconsistencies\n" +
    "- Personality shifts without justification\n" +
    "- Dialogue that doesn't match established voice\n" +
    "- Knowledge the character shouldn't have\n" +
    "- Contradictory motivations or goals\n" +
    "- Relationship dynamics that conflict with established history\n\n" +
    "FORMAT YOUR RESPONSE AS:\n\n" +
    "### Plot Holes\n[List with severity: CRITICAL/MAJOR/MINOR]\n\n" +
    "### Timeline Issues\n[List with specific events/dates]\n\n" +
    "### Character Inconsistencies\n[List with character name]\n\n" +
    "### Summary\n[Brief assessment and prioritized recommendations]\n\n" +
    "If no issues found in a category, state 'No issues detected.' " +
    "Be thorough but avoid false positives.",
};

interface ImageAttachment {
  url: string;
}

interface BuildMessagesOptions {
  postChatInstructions?: string;
  postChatInstructionsDepth?: number;
  assistantPrefill?: string;
  customSystemPrompt?: string | null;
  toolPromptOverride?: string;
  images?: ImageAttachment[];
  enableToolCalling?: boolean;
  skipUserPrompt?: boolean;
}

function resolveDefaultToolInstruction(
  tool: AiToolId,
  hasSelectedText: boolean,
  isScreenplay?: boolean,
): string {
  // Use screenplay-specific overrides when applicable
  if (isScreenplay) {
    const override = SCREENPLAY_TOOL_INSTRUCTIONS[tool as BuiltinAiTool];
    if (override) return override;
  }

  if (tool === "suggest-edits" && !hasSelectedText) {
    return (
      "Suggest concrete line edits to improve the current chapter. " +
      "Focus on the weakest passages. " +
      "Format as a numbered list with the original text and your suggested replacement."
    );
  }
  if (tool in DEFAULT_TOOL_INSTRUCTIONS) {
    return DEFAULT_TOOL_INSTRUCTIONS[tool as BuiltinAiTool];
  }
  return "Follow the user's instructions.";
}

export function buildMessages(
  tool: AiToolId,
  userPrompt: string,
  context: AiContext,
  history: AiMessage[] = [],
  options?: BuildMessagesOptions,
): AiMessage[] {
  const toolInstruction =
    options?.toolPromptOverride ??
    resolveDefaultToolInstruction(
      tool,
      !!context.selectedText,
      context.projectMode === "screenplay",
    );

  const preamble = options?.customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const enableToolCalling = options?.enableToolCalling ?? false;

  let systemContent = `${preamble}\n\n<task>\n${toolInstruction}\n</task>`;

  if (enableToolCalling) {
    systemContent +=
      "\n\n<tool-calling-instructions>\n" +
      "You have tools to discover and manage the user's project.\n" +
      "The context above contains only the project's style guide for voice/tone reference.\n" +
      "Use tools to discover all other project data on demand:\n\n" +
      "DISCOVERY PATTERN:\n" +
      "1. Use list_* tools (list_characters, list_locations, list_chapters, list_timeline_events, list_style_guide, list_worldbuilding_docs) to find entity IDs.\n" +
      "2. Use get_* tools (get_character, get_location, get_chapter, get_timeline_event, get_style_guide_entry, get_worldbuilding_doc) for full details.\n" +
      "3. For chapter content, prefer PARTIAL retrieval to save tokens:\n" +
      "   a. get_chapter returns metadata including totalParagraphs and hasSceneBreaks.\n" +
      "   b. get_chapter_structure to see scene boundaries with paragraph numbers and previews.\n" +
      "   c. search_chapter to find specific passages by keyword within one chapter.\n" +
      "   d. read_chapter_range to read a range of paragraphs (e.g., paragraphs 1-20).\n" +
      "   e. read_chapter ONLY when you truly need the entire chapter.\n" +
      "4. Use get_outline to get the full outline grid.\n" +
      "5. Use search_project to search across ALL entity types by keyword (chapters, characters, locations, etc.).\n" +
      "6. Use search_chapters for chapter-content-only keyword search.\n\n" +
      "Fetch only what you need for the current task — don't retrieve everything upfront.\n" +
      "</tool-calling-instructions>";
  }

  const messages: AiMessage[] = [
    {
      role: "system",
      content: systemContent,
    },
  ];

  // Story bible context as a user message (cacheable)
  const contextXml = enableToolCalling
    ? buildAgenticContext(context)
    : buildNovelContext(context);
  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: contextXml,
        cache_control: { type: "ephemeral" },
      },
    ],
  });
  messages.push({ role: "assistant", content: "Understood." });

  if (context.currentChapterContent) {
    const title = context.currentChapterTitle ?? "Untitled";
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: `<chapter title="${title}">\n${context.currentChapterContent}\n</chapter>`,
          cache_control: { type: "ephemeral" },
        },
      ],
    });
    messages.push({ role: "assistant", content: "Understood." });
  }

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    const isLast = i === history.length - 1;

    // In agentic mode, mark the last history message with cache_control so
    // the entire conversation prefix is cached across tool-calling iterations.
    let content = msg.content;
    if (enableToolCalling && isLast && history.length > 0) {
      if (typeof content === "string") {
        content = [
          {
            type: "text" as const,
            text: content,
            cache_control: { type: "ephemeral" as const },
          },
        ];
      } else if (Array.isArray(content)) {
        // Append cache_control to the last text part
        const parts = [...content];
        for (let j = parts.length - 1; j >= 0; j--) {
          if (parts[j].type === "text") {
            parts[j] = { ...parts[j], cache_control: { type: "ephemeral" } };
            break;
          }
        }
        content = parts;
      }
    }

    messages.push({
      role: msg.role,
      content,
      ...(msg.toolCalls ? { toolCalls: msg.toolCalls } : {}),
      ...(msg.toolCallId ? { toolCallId: msg.toolCallId } : {}),
    });
  }

  if (!options?.skipUserPrompt) {
    const imageAttachments = options?.images;
    if (context.selectedText) {
      const text = `<selected-text>\n${context.selectedText}\n</selected-text>\n\n${userPrompt}`;
      if (imageAttachments && imageAttachments.length > 0) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text },
            ...imageAttachments.map((img) => ({
              type: "image_url" as const,
              image_url: { url: img.url },
            })),
          ],
        });
      } else {
        messages.push({ role: "user", content: text });
      }
    } else if (imageAttachments && imageAttachments.length > 0) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...imageAttachments.map((img) => ({
            type: "image_url" as const,
            image_url: { url: img.url },
          })),
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }
  }

  // Inject post-chat instructions into the Nth-last user message
  const instructions = options?.postChatInstructions;
  const depth = options?.postChatInstructionsDepth ?? 2;
  if (instructions && depth > 0) {
    // Collect indices of real user messages (exclude synthetic story-bible and chapter-context messages)
    const syntheticUserCount = 1 + (context.currentChapterContent ? 1 : 0);
    const userIndices: number[] = [];
    let skipped = 0;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role !== "user") continue;
      if (skipped < syntheticUserCount) {
        skipped++;
        continue;
      }
      userIndices.push(i);
    }

    if (userIndices.length > 0) {
      const targetIdx = userIndices[Math.max(0, userIndices.length - depth)];
      const msg = messages[targetIdx];
      if (typeof msg.content === "string") {
        messages[targetIdx] = {
          ...msg,
          content: `${msg.content}\n\n${instructions}`,
        };
      } else if (Array.isArray(msg.content)) {
        messages[targetIdx] = {
          ...msg,
          content: [
            ...msg.content,
            { type: "text" as const, text: instructions },
          ],
        };
      }
    }
  }

  if (options?.assistantPrefill) {
    messages.push({ role: "assistant", content: options.assistantPrefill });
  }

  return messages;
}
