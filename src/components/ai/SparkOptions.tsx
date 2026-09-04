"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { BUTTON_PRIMARY } from "@/components/ui/form-styles";
import { SPARK_OPTION_DELIMITER } from "@/lib/ai/agents/builtins/defaults";
import { useEditorStore } from "@/store/editorStore";

interface SparkOptionsProps {
  /** Raw assistant content from the spark agent. */
  content: string;
  /**
   * Selection range captured at submit time. When set, picking an option
   * replaces this range; otherwise the option inserts at the cursor.
   */
  capturedRange?: { from: number; to: number } | null;
}

/**
 * Renders Spark output as up to 3 option cards with Insert buttons. Splits on
 * the literal `<<<OPTION>>>` delimiter the system prompt instructs the model
 * to emit. Tolerates fewer than 3 options if the model deviates — never more
 * than 3 displayed.
 */
export function SparkOptions({ content, capturedRange }: SparkOptionsProps) {
  const requestInsertAtCursor = useEditorStore((s) => s.requestInsertAtCursor);
  const [insertedIndex, setInsertedIndex] = useState<number | null>(null);

  const options = parseSparkOptions(content);

  if (options.length === 0) {
    return (
      <div className="mt-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Spark didn't emit any options. Try regenerating or adjusting your
        prompt.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {options.map((opt, i) => {
        const isInserted = insertedIndex === i;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: order is the identity
            key={i}
            className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">
              {opt}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Option {i + 1} of {options.length}
              </span>
              <button
                type="button"
                disabled={isInserted}
                onClick={() => {
                  requestInsertAtCursor({
                    markdown: opt,
                    replaceRange: capturedRange ?? undefined,
                  });
                  setInsertedIndex(i);
                }}
                className={`${BUTTON_PRIMARY} inline-flex items-center gap-1.5 text-xs disabled:opacity-50`}
              >
                {isInserted ? (
                  <>
                    <Check size={12} />
                    Inserted
                  </>
                ) : (
                  "Insert at cursor"
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseSparkOptions(content: string): string[] {
  return content
    .split(SPARK_OPTION_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);
}
