import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import type { GrammarService } from "@/lib/grammar";
import { type GrammarResult, getGrammarService } from "@/lib/grammar";
import { useGrammarStore } from "@/store/grammarStore";

interface GrammarRefs {
  grammarServiceRef: MutableRefObject<GrammarService | null>;
  grammarEnabledRef: MutableRefObject<boolean>;
  ignoredLintsRef: MutableRefObject<Set<string>>;
  onGrammarContextMenu: (result: GrammarResult, rect: DOMRect) => void;
  /** Increments when grammar state changes and decorations need rebuilding. */
  grammarVersion: number;
}

/**
 * Manages the grammar-checker lifecycle: lazy-loading the harper-backed service,
 * tracking the persisted enable toggle (from {@link useAppSettings}), the
 * session-ignored lints, and a `grammarVersion` counter the caller uses to
 * trigger a decoration rebuild.
 *
 * Symmetric with {@link useEditorSpellcheck}; the one difference is that the
 * enable flag is a persisted AppSettings field rather than a session store value.
 */
export function useEditorGrammar(): GrammarRefs {
  const settings = useAppSettings();
  // Default to on while settings load, matching the schema default.
  const grammarEnabled = settings?.grammarCheckerEnabled ?? false;
  const disabledLintKinds = settings?.disabledLintKinds;
  const ruleOverrides = settings?.grammarRuleOverrides;
  const ignoredLints = useGrammarStore((s) => s.ignoredLints);
  const openContextMenu = useGrammarStore((s) => s.openContextMenu);

  const grammarServiceRef = useRef<GrammarService | null>(null);
  const grammarEnabledRef = useRef(grammarEnabled);
  grammarEnabledRef.current = grammarEnabled;
  const ignoredLintsRef = useRef<Set<string>>(new Set());
  ignoredLintsRef.current = ignoredLints;

  const [grammarLoaded, setGrammarLoaded] = useState(() =>
    getGrammarService().isLoaded(),
  );

  // Load the service only once the feature is enabled — harper's WASM is heavy,
  // so there's no reason to pay for it when grammar checking is off.
  useEffect(() => {
    if (!grammarEnabled) return;
    const service = getGrammarService();
    grammarServiceRef.current = service;

    if (service.isLoaded()) {
      setGrammarLoaded(true);
    } else if (!service.isLoading()) {
      service
        .load()
        .then(() => setGrammarLoaded(true))
        .catch(() => {
          // Error already logged in the service; leave grammarLoaded false.
        });
    }
  }, [grammarEnabled]);

  // Bump the version whenever state that affects decorations changes, so the
  // editor re-runs the check (e.g. toggled on, a lint ignored, service ready).
  const [grammarVersion, setGrammarVersion] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: these deps intentionally trigger version bumps
  useEffect(() => {
    setGrammarVersion((v) => v + 1);
  }, [grammarEnabled, ignoredLints, grammarLoaded]);

  // Apply the user's category + per-rule filters to the service, then re-check.
  // Serialize the deps so this only runs when the filter values actually change
  // (the parsed settings objects are fresh references on every render).
  const kindsKey = JSON.stringify(disabledLintKinds ?? []);
  const overridesKey = JSON.stringify(ruleOverrides ?? {});
  useEffect(() => {
    const service = getGrammarService();
    service.setDisabledKinds(new Set<string>(JSON.parse(kindsKey)));
    let cancelled = false;
    service
      .applyRuleOverrides(JSON.parse(overridesKey))
      .catch(() => {
        // Error already logged in the service.
      })
      .finally(() => {
        if (!cancelled) setGrammarVersion((v) => v + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [kindsKey, overridesKey]);

  const onGrammarContextMenu = useCallback(
    (result: GrammarResult, rect: DOMRect) => {
      openContextMenu({ result, rect });
    },
    [openContextMenu],
  );

  return {
    grammarServiceRef,
    grammarEnabledRef,
    ignoredLintsRef,
    onGrammarContextMenu,
    grammarVersion,
  };
}
