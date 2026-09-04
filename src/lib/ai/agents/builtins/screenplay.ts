import type { AiContext } from "../../types";

/**
 * Format suffix appended to pipeline-agent system prompts when the project is
 * a screenplay. Keeps the core agent discipline identical and just retunes
 * format expectations — far less surface area than maintaining two parallel
 * prompts per agent.
 */
const SCREENPLAY_SUFFIX = `

<format-override>
This project is a SCREENPLAY in Fountain format. Throughout this run:
- "Chapters" in tool names refer to whatever the manuscript stores per file (typically scenes or sequences).
- Screenplay conventions — scene-heading style (INT./EXT. — LOCATION — DAY/NIGHT), action paragraph rhythm, character cues, parentheticals, dialogue tics — belong in the style guide, not narrative prose.
- Continuity for screenplays includes: timeline of scene transitions, props and costume continuity, character knowledge per scene, and on-screen vs off-screen action.
- When proposing edits, newContent must be valid Fountain (no narrative prose, no internal monologue unless via voice-over). Scene headings, character cues uppercase, parentheticals in (parens), dialogue indented under cues.
</format-override>`;

export function withScreenplaySuffix(
  basePrompt: string,
  context: AiContext,
): string {
  if (context.projectMode === "screenplay") {
    return basePrompt + SCREENPLAY_SUFFIX;
  }
  return basePrompt;
}
