import type { Chapter } from "@/db/schemas";
import { serializeStyleGuideEntry } from "./serialize";
import type { AiContext, AiMessage } from "./types";

export const DEFAULT_SYSTEM_PROMPT = "You are a creative writing assistant.";

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildTableOfContents(chapters: readonly Chapter[]): string {
  if (chapters.length === 0) return "";
  const lines = chapters.map(
    (c) =>
      `  <chapter id="${escapeAttr(c.id)}" order="${c.order}" title="${escapeAttr(c.title)}" status="${c.status}" wordCount="${c.wordCount}" />`,
  );
  return `<table-of-contents>\n${lines.join("\n")}\n</table-of-contents>\n\n`;
}

/**
 * Build the cache-stable initial project context for chat-mode and pipeline
 * agents. Includes top-level project details (title, description, genre,
 * mode) plus the style guide and a chapter table of contents so the model
 * knows the manuscript's shape before reaching for tools. Everything else
 * (characters, locations, timeline, worldbuilding, outline grid, chapter
 * prose) is fetched on demand via tool calls.
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

  xml += buildTableOfContents(context.chapters);

  xml += `</${rootTag}>`;
  return xml;
}

export interface BuildMessagesOptions {
  postChatInstructions?: string;
  postChatInstructionsDepth?: number;
  assistantPrefill?: string;
  customSystemPrompt?: string | null;
  enableToolCalling?: boolean;
}

/**
 * Assemble messages for a chat-mode AI request.
 *
 * `agentSystemPrompt` is the agent's resolved system content (taken from the
 * AgentDefinition row, with any screenplay suffix already applied). This
 * function wraps it with the optional `customSystemPrompt` preamble and a
 * <task>...</task> framing block, then appends:
 *   1. Minimal project context (top-level details + style guide + TOC)
 *   2. Optional <chapter>...</chapter> block for the active chapter
 *   3. Conversation history (with cache_control on the last entry in agentic mode)
 *   4. Optional assistant prefill
 *
 * The user's prompt arrives in `history` already wire-formatted — the chat
 * panel converts the canonical `ChatMessage[]` (which carries selectedText
 * and image attachments separately) via `toAiMessages` before calling.
 */
export function buildMessages(
  agentSystemPrompt: string,
  context: AiContext,
  history: AiMessage[] = [],
  options?: BuildMessagesOptions,
): AiMessage[] {
  const preamble = options?.customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const enableToolCalling = options?.enableToolCalling ?? false;

  let systemContent = `${preamble}\n\n<task>\n${agentSystemPrompt}\n</task>`;

  if (enableToolCalling) {
    systemContent +=
      "\n\n<tool-calling-instructions>\n" +
      "You have tools to discover and manage the user's project.\n" +
      "The context above contains the project's top-level details, style guide, and a chapter table of contents (id + title).\n" +
      "Use tools to discover all other project data on demand:\n\n" +
      "DISCOVERY PATTERN:\n" +
      "1. `list({ category })` returns the index for one category. Categories: character, location, timeline, chapter, style_guide, worldbuilding.\n" +
      '2. `get({ requests: [{ category, ids }, ...] })` fetches full details. One call can batch across categories — e.g. requests=[{category:"character", ids:[...]}, {category:"location", ids:[...]}]. Singletons (outline) take no ids; summaries take chapter ids.\n' +
      "3. For chapter content, prefer PARTIAL retrieval to save tokens:\n" +
      '   a. `get({ requests: [{ category: "chapter", ids: [<id>] }] })` returns metadata including totalParagraphs and hasSceneBreaks.\n' +
      "   b. get_chapter_structure to see scene boundaries with paragraph numbers and previews.\n" +
      "   c. search_chapter to find specific passages by keyword within one chapter.\n" +
      "   d. read_chapter_range to read a range of paragraphs (e.g., paragraphs 1-20).\n" +
      "   e. read_chapter ONLY when you truly need the entire chapter.\n" +
      '4. Use `get({ requests: [{ category: "outline" }] })` to get the full outline grid.\n' +
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

  // Story bible context as a user message (cacheable). Tool-calling agents
  // and chat agents now share the same minimal shape — top-level project
  // details, style guide, and chapter TOC. Anything richer (characters,
  // locations, etc.) is fetched on demand via tools.
  const contextXml = buildAgenticContext(context);
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

  // Inject post-chat instructions into the Nth-last user message
  const instructions = options?.postChatInstructions;
  const depth = options?.postChatInstructionsDepth ?? 2;
  if (instructions && depth > 0) {
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
