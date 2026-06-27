"use client";

import { ChevronDown, ChevronRight, RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { updateAppSettings } from "@/db/operations";
import { DEFAULT_DISABLED_LINT_KINDS } from "@/db/schemas";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import { type GrammarRuleInfo, getGrammarService } from "@/lib/grammar";
import { GRAMMAR_CATEGORIES } from "@/lib/grammar/categories";
import { useUiStore } from "@/store/uiStore";

const CHECKBOX_CLASS =
  "mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 dark:border-neutral-600";

export function GrammarRulesDialog() {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const settings = useAppSettings();

  const isOpen = modal.id === "grammar-rules";

  const [rules, setRules] = useState<GrammarRuleInfo[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [filter, setFilter] = useState("");

  // Load the grammar service (even if the feature is toggled off) so we can
  // enumerate harper's rules for the list.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setRules(null);
    setLoadError(false);
    const service = getGrammarService();
    (service.isLoaded() ? Promise.resolve() : service.load())
      .then(() => service.getRuleInfo())
      .then((info) => {
        if (!cancelled) setRules(info);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const disabledKinds = settings?.disabledLintKinds ?? [];
  const overrides = settings?.grammarRuleOverrides ?? {};

  async function toggleCategory(kind: string, enabled: boolean) {
    const next = enabled
      ? disabledKinds.filter((k) => k !== kind)
      : [...disabledKinds, kind];
    await updateAppSettings({ disabledLintKinds: next });
  }

  async function toggleRule(rule: GrammarRuleInfo, enabled: boolean) {
    const next = { ...overrides };
    // Store only genuine overrides; a value equal to harper's default is dropped.
    if (enabled === rule.defaultEnabled) {
      delete next[rule.key];
    } else {
      next[rule.key] = enabled;
    }
    await updateAppSettings({ grammarRuleOverrides: next });
  }

  async function handleReset() {
    await updateAppSettings({
      disabledLintKinds: [...DEFAULT_DISABLED_LINT_KINDS],
      grammarRuleOverrides: {},
    });
  }

  // "Dirty" relative to the defaults, so Reset is disabled when already default.
  const isDefaultKinds =
    disabledKinds.length === DEFAULT_DISABLED_LINT_KINDS.length &&
    DEFAULT_DISABLED_LINT_KINDS.every((k) => disabledKinds.includes(k));
  const hasOverrides = !isDefaultKinds || Object.keys(overrides).length > 0;

  const filteredRules = rules
    ? filter
      ? rules.filter((r) => r.key.toLowerCase().includes(filter.toLowerCase()))
      : rules
    : [];

  return (
    <Modal onClose={closeModal} maxWidth="max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Grammar Rules
        </h2>
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasOverrides}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <RotateCcw size={13} />
          Reset to defaults
        </button>
      </div>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Choose which grammar and style checks harper applies. Spelling is
        handled separately by the spell checker.
      </p>

      {/* Categories */}
      <fieldset className="mt-4">
        <legend className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Categories
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {GRAMMAR_CATEGORIES.map((category) => (
            <label
              key={category.kind}
              className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300"
            >
              <input
                type="checkbox"
                checked={!disabledKinds.includes(category.kind)}
                onChange={(e) =>
                  toggleCategory(category.kind, e.target.checked)
                }
                className={CHECKBOX_CLASS}
              />
              <span>
                <span className="font-medium">{category.label}</span>
                <span className="block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                  {category.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Individual rules */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setRulesExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {rulesExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          Individual rules
        </button>

        {rulesExpanded && (
          <div className="mt-3">
            {loadError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                Failed to load grammar rules.
              </p>
            ) : rules === null ? (
              <p className="text-sm italic text-neutral-500 dark:text-neutral-400">
                Loading rules…
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter rules..."
                    className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-8 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                </div>
                <div className="mt-2 max-h-[320px] overflow-y-auto rounded-md border border-neutral-200 dark:border-neutral-700">
                  {filteredRules.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
                      No rules match your filter.
                    </p>
                  ) : (
                    <ul>
                      {filteredRules.map((rule) => (
                        <li
                          key={rule.key}
                          className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-800"
                        >
                          <label className="flex items-start gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300">
                            <input
                              type="checkbox"
                              checked={
                                overrides[rule.key] ?? rule.defaultEnabled
                              }
                              onChange={(e) =>
                                toggleRule(rule, e.target.checked)
                              }
                              className={CHECKBOX_CLASS}
                            />
                            <span>
                              <span className="font-medium">{rule.key}</span>
                              {rule.description && (
                                <span className="block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                                  {rule.description}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
