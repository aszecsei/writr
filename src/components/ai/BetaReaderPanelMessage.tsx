"use client";

import {
  BETA_READER_PERSONA_ATTRIBUTION,
  BETA_READER_PERSONA_IDS,
  type BetaReaderPersonaId,
} from "@/lib/ai/agents/builtins/betaReader";
import { MarkdownMessage } from "./MarkdownMessage";

interface BetaReaderPanelMessageProps {
  /** Raw assistant content from the beta-reader panel agent. */
  content: string;
}

/**
 * Renders Beta Reader panel output as three labeled persona sections.
 *
 * The system prompt instructs the model to emit three blocks: `<maya>…</maya>`,
 * `<anton>…</anton>`, `<joan>…</joan>`. During streaming we render the raw
 * text so the user sees output as it arrives; once the model closes a tag we
 * extract that section. If parsing fails entirely (model malformed the
 * output), we fall back to raw markdown with a warning chip so content is
 * never silently dropped.
 */
export function BetaReaderPanelMessage({
  content,
}: BetaReaderPanelMessageProps) {
  const sections = parsePanelSections(content);
  const hasAnySection = BETA_READER_PERSONA_IDS.some(
    (id) => sections[id] !== undefined,
  );

  // No closing tags yet — model is still mid-stream. Show the raw content so
  // the user sees something landing instead of an empty bubble.
  if (!hasAnySection) {
    return <MarkdownMessage content={content} />;
  }

  // Render in the canonical panel order regardless of model output order.
  const ordered = BETA_READER_PERSONA_IDS.filter(
    (id) => sections[id] !== undefined,
  );
  const missing = BETA_READER_PERSONA_IDS.filter(
    (id) => sections[id] === undefined,
  );

  return (
    <div className="space-y-3">
      {ordered.map((id) => {
        const attr = BETA_READER_PERSONA_ATTRIBUTION[id];
        const body = sections[id] ?? "";
        return (
          <section
            key={id}
            className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900"
            style={{ borderLeft: `3px solid ${attr.authorColor}` }}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: attr.authorColor }}
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-200">
                {attr.name}
              </span>
            </div>
            <MarkdownMessage content={body} />
          </section>
        );
      })}
      {missing.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
          Missing block{missing.length === 1 ? "" : "s"}:{" "}
          {missing
            .map((id) => BETA_READER_PERSONA_ATTRIBUTION[id].name)
            .join(", ")}
          .
        </div>
      )}
    </div>
  );
}

/**
 * Pull `<maya>…</maya>`, `<anton>…</anton>`, `<joan>…</joan>` blocks out of
 * a streamed/finished assistant message. Returns the trimmed body per
 * persona; missing personas are omitted from the result. Tolerates extra
 * whitespace and content outside the persona blocks (which is dropped).
 */
function parsePanelSections(
  content: string,
): Partial<Record<BetaReaderPersonaId, string>> {
  const out: Partial<Record<BetaReaderPersonaId, string>> = {};
  for (const id of BETA_READER_PERSONA_IDS) {
    // Non-greedy: stop at the first closing tag so consecutive personas
    // don't all swallow into the first match.
    const re = new RegExp(`<${id}>([\\s\\S]*?)<\\/${id}>`, "i");
    const m = content.match(re);
    if (m) {
      const body = m[1].trim();
      if (body.length > 0) out[id] = body;
    }
  }
  return out;
}
