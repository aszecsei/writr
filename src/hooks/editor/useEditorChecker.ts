import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";

interface EditorCheckerService {
  isLoaded: () => boolean;
  isLoading: () => boolean;
  load: () => Promise<unknown>;
}

interface UseEditorCheckerOptions<
  TService extends EditorCheckerService,
  TIgnored,
> {
  /** Whether the service should load at all. */
  enabled: boolean;
  getService: () => TService;
  /** The current session-ignored set; mirrored into a ref every render. */
  ignored: TIgnored;
  /** Called if `load()` rejects. Omit to let the rejection propagate. */
  onLoadError?: (error: unknown) => void;
}

interface EditorCheckerResult<TService, TIgnored> {
  serviceRef: MutableRefObject<TService | null>;
  ignoredRef: MutableRefObject<TIgnored>;
  loaded: boolean;
}

/**
 * Shared lifecycle for the spellcheck and grammar checker services: lazily
 * loads the service, tracks readiness, and mirrors the latest ignored-set
 * into a ref so the TipTap extension can read it without forcing a rebuild.
 */
export function useEditorChecker<
  TService extends EditorCheckerService,
  TIgnored,
>({
  enabled,
  getService,
  ignored,
  onLoadError,
}: UseEditorCheckerOptions<TService, TIgnored>): EditorCheckerResult<
  TService,
  TIgnored
> {
  const serviceRef = useRef<TService | null>(null);
  const ignoredRef = useRef(ignored);
  ignoredRef.current = ignored;

  const [loaded, setLoaded] = useState(() =>
    enabled ? getService().isLoaded() : false,
  );

  useEffect(() => {
    if (!enabled) return;
    const service = getService();
    serviceRef.current = service;

    if (service.isLoaded()) {
      setLoaded(true);
      return;
    }
    if (!service.isLoading()) {
      const result = service.load().then(() => setLoaded(true));
      if (onLoadError) result.catch(onLoadError);
    }
  }, [enabled, getService, onLoadError]);

  return { serviceRef, ignoredRef, loaded };
}
