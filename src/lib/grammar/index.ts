import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Lint, LintConfig, Linter } from "harper.js";
import { extractBlocks, mapSpanToRange } from "./extractor";

/** Metadata for a single harper lint rule, for rendering the rule-filter UI. */
export interface GrammarRuleInfo {
  /** harper's rule key, e.g. "SentenceCapitalization". */
  key: string;
  /** Markdown description of what the rule checks. */
  description: string;
  /** Whether the rule is enabled in harper's default configuration. */
  defaultEnabled: boolean;
}

/** A single applicable fix for a grammar issue. */
export interface GrammarSuggestion {
  /** Human-readable label shown in the UI (e.g. the replacement, or "Remove"). */
  label: string;
  /** The text to substitute for the flagged span. Empty string = deletion. */
  replacement: string;
}

/** A grammar issue mapped to ProseMirror positions. Plain data only — no WASM handles. */
export interface GrammarResult {
  /** ProseMirror start position (inclusive). */
  from: number;
  /** ProseMirror end position (exclusive). */
  to: number;
  /** harper's description of the problem. */
  message: string;
  /** harper's general category (e.g. "Agreement", "Style"). */
  kind: string;
  /** harper's rule key that produced this lint (for the "disable rule" action). */
  ruleKey: string;
  /** The flagged source text — also used as the session-ignore key. */
  problemText: string;
  /** Suggested fixes, pre-computed (harper provides them upfront). */
  suggestions: GrammarSuggestion[];
}

/**
 * harper lint categories that overlap with the existing nspell spell checker.
 * These are filtered out so nspell remains the sole source of spelling errors —
 * avoiding double underlines and false positives on custom-dictionary words
 * (character/location names).
 */
const SPELLING_KINDS = new Set(["Spelling", "Typo"]);

/**
 * harper rule keys that only affect spelling. Hidden from the rule-filter UI
 * since spelling is owned by nspell and filtered out regardless (toggling them
 * would have no visible effect).
 */
const SPELLING_RULE_KEYS = new Set(["SpellCheck", "SpelledNumbers"]);

/** Build the per-span replacement string + display label from a harper suggestion. */
function readSuggestion(
  // biome-ignore lint/suspicious/noExplicitAny: harper's Suggestion type isn't re-exported cleanly across the worker boundary
  suggestion: any,
  problemText: string,
): GrammarSuggestion {
  // SuggestionKind: 0 = Replace, 1 = Remove, 2 = InsertAfter
  const kind: number = suggestion.kind();
  const replacementText: string = suggestion.get_replacement_text();
  if (kind === 1) {
    return { label: "Remove", replacement: "" };
  }
  if (kind === 2) {
    return {
      label: `Insert "${replacementText}"`,
      replacement: problemText + replacementText,
    };
  }
  return {
    label: replacementText.length > 0 ? replacementText : "(empty)",
    replacement: replacementText,
  };
}

/**
 * Grammar-checking service backed by harper.js running in a web worker.
 *
 * Mirrors {@link SpellcheckService} in shape (lazy singleton, `load` /
 * `isLoaded` / `isLoading`, `checkDocument`) so the editor wiring is symmetric.
 * harper's WASM and worker are both inlined by the package, so no separate
 * assets need bundler configuration.
 */
export class GrammarService {
  private linter: Linter | null = null;
  private loading = false;
  private loadPromise: Promise<void> | null = null;
  /** Lint kinds (categories) the user has switched off — filtered post-hoc. */
  private disabledKinds: Set<string> = new Set();
  /** Per-rule overrides (rule key → enabled), applied via harper's config. */
  private ruleOverrides: Record<string, boolean> = {};

  async load(): Promise<void> {
    if (this.linter) return;
    if (this.loadPromise) return this.loadPromise;

    this.loading = true;
    this.loadPromise = this.doLoad();
    try {
      await this.loadPromise;
    } finally {
      this.loading = false;
    }
  }

  private async doLoad(): Promise<void> {
    try {
      const [{ WorkerLinter, Dialect }, { binaryInlined }] = await Promise.all([
        import("harper.js"),
        // Inlined binary (WASM as a data URL) — no separate asset for the
        // bundler to resolve, which keeps this robust under Next/Turbopack.
        import("harper.js/binaryInlined"),
      ]);

      const linter = new WorkerLinter({
        binary: binaryInlined,
        dialect: Dialect.American,
      });
      await linter.setup();
      // Apply any overrides captured before the linter finished loading.
      await this.writeRuleConfig(linter);
      this.linter = linter;
    } catch (error) {
      console.error("Failed to load grammar checker:", error);
      throw error;
    }
  }

  isLoaded(): boolean {
    return this.linter !== null;
  }

  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Set the disabled lint categories (kinds). Takes effect on the next check;
   * the caller is responsible for triggering a re-check.
   */
  setDisabledKinds(kinds: Set<string>): void {
    this.disabledKinds = kinds;
  }

  /**
   * Apply per-rule overrides to harper's configuration. Rebuilds the full
   * config from harper's defaults and overlays the overrides, so removing an
   * override cleanly reverts to the default. Safe to call before the linter
   * has loaded — the overrides are stored and applied during setup.
   */
  async applyRuleOverrides(overrides: Record<string, boolean>): Promise<void> {
    this.ruleOverrides = overrides;
    if (this.linter) {
      await this.writeRuleConfig(this.linter);
    }
  }

  private async writeRuleConfig(linter: Linter): Promise<void> {
    const config: LintConfig = await linter.getDefaultLintConfig();
    for (const [key, enabled] of Object.entries(this.ruleOverrides)) {
      config[key] = enabled;
    }
    await linter.setLintConfig(config);
  }

  /**
   * Enumerate harper's individual lint rules for the rule-filter UI. Combines
   * the default config (for keys + default state) with the rule descriptions.
   * Spelling-only rules are omitted. Requires the linter to be loaded.
   */
  async getRuleInfo(): Promise<GrammarRuleInfo[]> {
    const linter = this.linter;
    if (!linter) return [];

    const [defaults, descriptions] = await Promise.all([
      linter.getDefaultLintConfig(),
      linter.getLintDescriptions(),
    ]);

    const keys = new Set([
      ...Object.keys(defaults),
      ...Object.keys(descriptions),
    ]);
    const info: GrammarRuleInfo[] = [];
    for (const key of keys) {
      if (SPELLING_RULE_KEYS.has(key)) continue;
      info.push({
        key,
        description: descriptions[key] ?? "",
        // null means "use harper's built-in default"; treat as enabled.
        defaultEnabled: defaults[key] !== false,
      });
    }
    info.sort((a, b) => a.key.localeCompare(b.key));
    return info;
  }

  /**
   * Check a ProseMirror document for grammar/style issues. Lints block-by-block
   * (preserving sentence context) and maps each harper span back to PM
   * positions. Spelling-category lints are dropped — see {@link SPELLING_KINDS}.
   */
  async checkDocument(
    doc: ProseMirrorNode,
    ignoredLints?: Set<string>,
  ): Promise<GrammarResult[]> {
    const linter = this.linter;
    if (!linter) return [];

    const blocks = extractBlocks(doc);
    const results: GrammarResult[] = [];

    for (const block of blocks) {
      if (block.text.trim().length === 0) continue;

      // organizedLints groups results by their source rule, so each lint
      // carries the rule key needed for the "disable rule" action.
      const organized = await linter.organizedLints(block.text, {
        language: "plaintext",
      });
      for (const [ruleKey, lints] of Object.entries(organized)) {
        for (const lint of lints) {
          this.collectLint(lint, ruleKey, block, ignoredLints, results);
        }
      }
    }

    return results;
  }

  private collectLint(
    lint: Lint,
    ruleKey: string,
    block: ReturnType<typeof extractBlocks>[number],
    ignoredLints: Set<string> | undefined,
    out: GrammarResult[],
  ): void {
    try {
      const kind = lint.lint_kind();
      if (SPELLING_KINDS.has(kind)) return;
      if (this.disabledKinds.has(kind)) return;

      const problemText = lint.get_problem_text();
      if (ignoredLints?.has(ignoreKey(kind, problemText))) return;

      const span = lint.span();
      const range = mapSpanToRange(block, span.start, span.end);
      span.free?.();
      if (!range) return;

      const suggestions = lint
        .suggestions()
        .map((suggestion) => readSuggestion(suggestion, problemText));

      out.push({
        from: range.from,
        to: range.to,
        message: lint.message(),
        kind,
        ruleKey,
        problemText,
        suggestions,
      });
    } finally {
      // Release the WASM-backed Lint now that its primitives are extracted.
      lint.free?.();
    }
  }
}

/**
 * Build the session-ignore key for a lint. Keyed on category + flagged text so
 * "ignore" suppresses the same issue wherever it recurs in the document.
 */
export function ignoreKey(kind: string, problemText: string): string {
  return `${kind} ${problemText}`;
}

// Singleton instance
let instance: GrammarService | null = null;

export function getGrammarService(): GrammarService {
  if (!instance) {
    instance = new GrammarService();
  }
  return instance;
}
