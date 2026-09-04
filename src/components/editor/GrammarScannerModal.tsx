"use client";

import type { Editor } from "@tiptap/react";
import { Ban, EyeOff, SkipForward } from "lucide-react";
import { useCallback, useEffect } from "react";
import { setGrammarRuleEnabled } from "@/db/operations";
import { scrollToPos } from "@/lib/editor/scroll";
import { type GrammarResult, ignoreKey } from "@/lib/grammar";
import { useGrammarStore } from "@/store/grammarStore";
import { isGrammarScannerModal, useUiStore } from "@/store/uiStore";
import { IssueScannerModal } from "./IssueScannerModal";

interface GrammarScannerModalProps {
  editor: Editor | null;
}

export function GrammarScannerModal({ editor }: GrammarScannerModalProps) {
  const modal = useUiStore((s) => s.modal);
  const closeModal = useUiStore((s) => s.closeModal);
  const scanner = useGrammarStore((s) => s.scanner);
  const nextIssue = useGrammarStore((s) => s.next);
  const prevIssue = useGrammarStore((s) => s.prev);
  const removeIssueAt = useGrammarStore((s) => s.removeAt);
  const removeIssuesByRule = useGrammarStore((s) => s.removeIssuesByRule);
  const ignoreLint = useGrammarStore((s) => s.addToIgnored);

  const isOpen = isGrammarScannerModal(modal);
  const current: GrammarResult | null =
    scanner.items[scanner.currentIndex] ?? null;

  useEffect(() => {
    if (!isOpen || !editor || !current) return;
    scrollToPos(editor, current.from, { center: true });
  }, [isOpen, editor, current]);

  const handleApply = useCallback(
    (replacement: string) => {
      if (!editor || !current) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: current.from, to: current.to }, replacement)
        .run();
      removeIssueAt(scanner.currentIndex);
    },
    [editor, current, removeIssueAt, scanner.currentIndex],
  );

  const handleIgnore = useCallback(() => {
    if (!current) return;
    ignoreLint(ignoreKey(current.kind, current.problemText));
    removeIssueAt(scanner.currentIndex);
  }, [current, ignoreLint, removeIssueAt, scanner.currentIndex]);

  const handleDisableRule = useCallback(() => {
    if (!current) return;
    void setGrammarRuleEnabled(current.ruleKey, false);
    // Drop every issue from this rule, not just the current one.
    removeIssuesByRule(current.ruleKey);
  }, [current, removeIssuesByRule]);

  const handleSkip = useCallback(() => {
    nextIssue();
  }, [nextIssue]);

  if (!isOpen) return null;

  const context = (() => {
    if (!editor || !current) return null;

    const doc = editor.state.doc;
    const docSize = doc.content.size;
    const contextPad = 40;

    const from = Math.max(1, current.from - contextPad);
    const to = Math.min(docSize, current.to + contextPad);

    const before = doc.textBetween(from, current.from, " ");
    const flagged = doc.textBetween(current.from, current.to, " ");
    const after = doc.textBetween(current.to, to, " ");

    return { before, highlighted: flagged, after };
  })();

  return (
    <IssueScannerModal
      title="Grammar Scanner"
      currentIndex={scanner.currentIndex}
      total={scanner.items.length}
      headline={
        <>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
            {current?.kind}
          </div>
          <div className="text-base font-medium text-neutral-900 dark:text-neutral-100">
            {current?.message}
          </div>
        </>
      }
      context={
        context
          ? {
              ...context,
              highlightClassName:
                "rounded bg-blue-100 px-0.5 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
            }
          : null
      }
      suggestions={
        current?.suggestions.map((suggestion) => ({
          key: `${suggestion.label}:${suggestion.replacement}`,
          label: suggestion.label,
          onSelect: () => handleApply(suggestion.replacement),
        })) ?? []
      }
      actions={[
        { key: "ignore", label: "Ignore", icon: EyeOff, onClick: handleIgnore },
        ...(current?.ruleKey
          ? [
              {
                key: "disable-rule",
                label: "Disable rule",
                icon: Ban,
                onClick: handleDisableRule,
              },
            ]
          : []),
        { key: "skip", label: "Skip", icon: SkipForward, onClick: handleSkip },
      ]}
      onNext={nextIssue}
      onPrev={prevIssue}
      onClose={closeModal}
      emptyState={{
        title: "Grammar Check Complete",
        message: "No grammar issues found.",
      }}
    />
  );
}
