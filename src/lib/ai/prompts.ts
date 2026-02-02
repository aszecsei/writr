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
  const genreAttr = context.genre ? ` genre="${context.genre}"` : "";
  let system = `You are a creative writing assistant.\n\n<novel title="${context.projectTitle}"${genreAttr}>\n\n`;

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
    system += context.worldbuildingDocs
      .map(serializeWorldbuildingDoc)
      .join("\n");
    system += "\n</worldbuilding>\n\n";
  }

  system += "</novel>\n\n";
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
  const systemContent = `${buildSystemContext(context)}<task>\n${TOOL_INSTRUCTIONS[tool]}\n</task>`;

  const messages: AiMessage[] = [{ role: "system", content: systemContent }];

  if (context.currentChapterContent) {
    const title = context.currentChapterTitle ?? "Untitled";
    messages.push({
      role: "user",
      content: `<chapter title="${title}">\n${context.currentChapterContent}\n</chapter>`,
    });
    messages.push({
      role: "assistant",
      content: "I've read the chapter. What would you like me to help with?",
    });
  }

  if (context.selectedText) {
    messages.push({
      role: "user",
      content: `<selected-text>\n${context.selectedText}\n</selected-text>\n\n${userPrompt}`,
    });
  } else {
    messages.push({ role: "user", content: userPrompt });
  }

  return messages;
}
