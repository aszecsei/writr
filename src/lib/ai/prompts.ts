import {
  buildCharacterNameMap,
  serializeCharacter,
  serializeLocation,
  serializeRelationship,
  serializeStyleGuideEntry,
  serializeTimelineEvent,
  serializeWorldbuildingDoc,
} from "./serialize";
import type { AiContext, AiMessage, AiTool } from "./types";

function buildSystemContext(context: AiContext): string {
  let system = `You are a creative writing assistant for the novel "${context.projectTitle}"`;
  if (context.genre) system += ` (genre: ${context.genre})`;
  system += ".\n\n";

  const charMap = buildCharacterNameMap(context.characters);

  if (context.characters.length > 0) {
    system += "## Key Characters\n";
    system += context.characters.map(serializeCharacter).join("\n\n");
    system += "\n\n";
  }

  if (context.relationships.length > 0) {
    const lines = context.relationships
      .map((r) => serializeRelationship(r, charMap))
      .filter(Boolean);
    if (lines.length > 0) {
      system += "## Character Relationships\n";
      system += lines.join("\n");
      system += "\n\n";
    }
  }

  if (context.locations.length > 0) {
    system += "## Key Locations\n";
    system += context.locations
      .map((l) => serializeLocation(l, charMap))
      .join("\n\n");
    system += "\n\n";
  }

  if (context.styleGuide.length > 0) {
    system += "## Style Guide\n";
    system += context.styleGuide.map(serializeStyleGuideEntry).join("\n\n");
    system += "\n\n";
  }

  if (context.timelineEvents.length > 0) {
    system += "## Timeline\n";
    system += context.timelineEvents
      .map((e) => serializeTimelineEvent(e, charMap))
      .join("\n\n");
    system += "\n\n";
  }

  if (context.worldbuildingDocs.length > 0) {
    system += "## Worldbuilding\n";
    system += context.worldbuildingDocs
      .map(serializeWorldbuildingDoc)
      .join("\n\n");
    system += "\n\n";
  }

  return system;
}

const TOOL_INSTRUCTIONS: Record<AiTool, string> = {
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
};

export function buildMessages(
  tool: AiTool,
  userPrompt: string,
  context: AiContext,
): AiMessage[] {
  const systemContent = `${buildSystemContext(context)}\n## Task\n${TOOL_INSTRUCTIONS[tool]}`;

  const messages: AiMessage[] = [{ role: "system", content: systemContent }];

  if (context.currentChapterContent) {
    messages.push({
      role: "user",
      content: `Here is the current chapter "${context.currentChapterTitle ?? "Untitled"}":\n\n${context.currentChapterContent}`,
    });
    messages.push({
      role: "assistant",
      content: "I've read the chapter. What would you like me to help with?",
    });
  }

  if (context.selectedText) {
    messages.push({
      role: "user",
      content: `Selected text:\n\n> ${context.selectedText}\n\n${userPrompt}`,
    });
  } else {
    messages.push({ role: "user", content: userPrompt });
  }

  return messages;
}
