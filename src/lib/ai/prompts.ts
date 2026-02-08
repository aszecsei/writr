import {
  buildChapterNameMap,
  buildCharacterNameMap,
  serializeCharacter,
  serializeLocation,
  serializeOutlineGrid,
  serializeRelationship,
  serializeStyleGuideEntry,
  serializeTimelineEvent,
  serializeWorldbuildingTree,
} from "./serialize";
import type {
  AiContext,
  AiMessage,
  AiToolId,
  BuiltinAiTool,
  ContentPart,
} from "./types";

export const DEFAULT_SYSTEM_PROMPT = "You are a creative writing assistant.";

function buildSystemContext(
  context: AiContext,
  customSystemPrompt?: string | null,
): string {
  const preamble = customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const genreAttr = context.genre ? ` genre="${context.genre}"` : "";
  let system = `${preamble}\n\n<novel title="${context.projectTitle}"${genreAttr}>\n\n`;

  const charMap = buildCharacterNameMap(context.characters);

  if (context.characters.length > 0) {
    system += "<characters>\n";
    system += context.characters.map(serializeCharacter).join("\n");
    system += "\n</characters>\n\n";
  }

  if (context.relationships.length > 0) {
    const lines = context.relationships
      .map((r) => serializeRelationship(r, charMap))
      .filter(Boolean);
    if (lines.length > 0) {
      system += "<relationships>\n";
      system += lines.join("\n");
      system += "\n</relationships>\n\n";
    }
  }

  if (context.locations.length > 0) {
    system += "<locations>\n";
    system += context.locations
      .map((l) => serializeLocation(l, charMap))
      .join("\n");
    system += "\n</locations>\n\n";
  }

  if (context.styleGuide.length > 0) {
    system += "<style-guide>\n";
    system += context.styleGuide.map(serializeStyleGuideEntry).join("\n");
    system += "\n</style-guide>\n\n";
  }

  if (context.timelineEvents.length > 0) {
    system += "<timeline>\n";
    system += context.timelineEvents
      .map((e) => serializeTimelineEvent(e, charMap))
      .join("\n");
    system += "\n</timeline>\n\n";
  }

  if (context.worldbuildingDocs.length > 0) {
    system += "<worldbuilding>\n";
    system += serializeWorldbuildingTree(context.worldbuildingDocs);
    system += "\n</worldbuilding>\n\n";
  }

  if (context.outlineGridColumns.length > 0) {
    const chapterMap = buildChapterNameMap(context.chapters);
    system += "<outline>\n";
    system += serializeOutlineGrid(
      context.outlineGridColumns,
      context.outlineGridRows,
      context.outlineGridCells,
      chapterMap,
    );
    system += "\n</outline>\n\n";
  }

  system += "</novel>\n\n";
  return system;
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
    (tool in DEFAULT_TOOL_INSTRUCTIONS
      ? DEFAULT_TOOL_INSTRUCTIONS[tool as BuiltinAiTool]
      : "Follow the user's instructions.");

  const systemContent: ContentPart[] = [
    {
      type: "text",
      text: buildSystemContext(context, options?.customSystemPrompt),
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `<task>\n${toolInstruction}\n</task>`,
    },
  ];

  const messages: AiMessage[] = [{ role: "system", content: systemContent }];

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
    messages.push({
      role: "assistant",
      content: "I've read the chapter. What would you like me to help with?",
    });
  }

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

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

  // Inject post-chat instructions into the Nth-last user message
  const instructions = options?.postChatInstructions;
  const depth = options?.postChatInstructionsDepth ?? 2;
  if (instructions && depth > 0) {
    // Collect indices of real user messages (exclude synthetic chapter-context message)
    const hasChapterContext = !!context.currentChapterContent;
    const userIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role !== "user") continue;
      // Skip the first user message when it's the synthetic chapter context
      if (hasChapterContext && userIndices.length === 0) continue;
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
