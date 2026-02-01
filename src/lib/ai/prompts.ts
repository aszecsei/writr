import type { AiContext, AiMessage, AiTool } from "./types";

function buildSystemContext(context: AiContext): string {
  let system = `You are a creative writing assistant for the novel "${context.projectTitle}"`;
  if (context.genre) system += ` (genre: ${context.genre})`;
  system += ".\n\n";

  if (context.characters.length > 0) {
    system += "## Key Characters\n";
    for (const c of context.characters) {
      system += `- **${c.name}** (${c.role}): ${c.description}\n`;
    }
    system += "\n";
  }

  if (context.locations.length > 0) {
    system += "## Key Locations\n";
    for (const l of context.locations) {
      system += `- **${l.name}**: ${l.description}\n`;
    }
    system += "\n";
  }

  if (context.styleGuide.length > 0) {
    system += "## Style Guide\n";
    for (const s of context.styleGuide) {
      system += `### ${s.title}\n${s.content}\n\n`;
    }
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
