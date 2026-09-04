import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppSettings } from "@/hooks/data/useAppSettings";
import type { GrammarService } from "@/lib/grammar";
import { type GrammarResult, getGrammarService } from "@/lib/grammar";
import { useGrammarStore } from "@/store/grammarStore";
import { useEditorChecker } from "./useEditorChecker";

interface GrammarRefs {
  grammarServiceRef: MutableRefObject<GrammarService | null>;
  grammarEnabledRef: MutableRefObject<boolean>;
  ignoredLintsRef: MutableRefObject<Set<string>>;
  onGrammarContextMenu: (result: GrammarResult, rect: DOMRect) => void;
  /** Changes identity whenever grammar state changes and decorations need rebuilding. */
  grammarVersion: readonly unknown[];
}

/**
 * Manages the grammar-checker lifecycle: lazy-loading the harper-backed service,
 * tracking the persisted enable toggle (from {@link useAppSettings}), the
 * session-ignored lints, and a `grammarVersion` value the caller uses to
 * trigger a decoration rebuild.
 *
 * Symmetric with {@link useEditorSpellcheck}; the one difference is that the
 * enable flag is a persisted AppSettings field rather than a session store value.
 */
export function useEditorGrammar(): GrammarRefs {
  const settings = useAppSettings();
  // Default to off while settings load, matching the schema default.
  const grammarEnabled = settings?.grammarCheckerEnabled ?? false;
  const disabledLintKinds = settings?.disabledLintKinds;
  const ruleOverrides = settings?.grammarRuleOverrides;
  const ignoredLints = useGrammarStore((s) => s.ignored);
  const openContextMenu = useGrammarStore((s) => s.openContextMenu);

  const grammarEnabledRef = useRef(grammarEnabled);
  grammarEnabledRef.current = grammarEnabled;

  const handleLoadError = useCallback(() => {
    // Error already logged in the service; leave `loaded` false.
  }, []);

  // Load the service only once the feature is enabled — harper's WASM is heavy,
  // so there's no reason to pay for it when grammar checking is off.
  const { serviceRef, ignoredRef, loaded } = useEditorChecker({
    enabled: grammarEnabled,
    getService: getGrammarService,
    ignored: ignoredLints,
    onLoadError: handleLoadError,
  });

  // Apply the user's category + per-rule filters to the service, then re-check.
  // Serialize the deps so this only runs when the filter values actually change
  // (the parsed settings objects are fresh references on every render).
  const kindsKey = JSON.stringify(disabledLintKinds ?? []);
  const overridesKey = JSON.stringify(ruleOverrides ?? {});
  const [ruleFilterVersion, setRuleFilterVersion] = useState(0);
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
        if (!cancelled) setRuleFilterVersion((v) => v + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [kindsKey, overridesKey]);

  const grammarVersion = useMemo(
    () => [grammarEnabled, ignoredLints, loaded, ruleFilterVersion] as const,
    [grammarEnabled, ignoredLints, loaded, ruleFilterVersion],
  );

  const onGrammarContextMenu = useCallback(
    (result: GrammarResult, rect: DOMRect) => {
      openContextMenu({ result, rect });
    },
    [openContextMenu],
  );

  return {
    grammarServiceRef: serviceRef,
    grammarEnabledRef,
    ignoredLintsRef: ignoredRef,
    onGrammarContextMenu,
    grammarVersion,
  };
}
