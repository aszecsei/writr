export interface LazyService<T> {
  /** Load the resource, or await the in-flight load. No-op once loaded. */
  load(): Promise<void>;
  isLoaded(): boolean;
  isLoading(): boolean;
  /** The loaded resource, or `null` before/while loading. */
  get(): T | null;
}

/**
 * Lazy singleton resource loader shared by {@link SpellcheckService} and
 * {@link GrammarService}: dedupes concurrent `load()` calls via a shared
 * promise, and always clears `isLoading` — including when `doLoad` throws —
 * so a failed load can be retried.
 */
export function createLazyService<T>(doLoad: () => Promise<T>): LazyService<T> {
  let resource: T | null = null;
  let loading = false;
  let loadPromise: Promise<void> | null = null;

  async function load(): Promise<void> {
    if (resource) return;
    if (loadPromise) return loadPromise;

    loading = true;
    loadPromise = doLoad()
      .then((loaded) => {
        resource = loaded;
      })
      .finally(() => {
        loading = false;
      });
    await loadPromise;
  }

  return {
    load,
    isLoaded: () => resource !== null,
    isLoading: () => loading,
    get: () => resource,
  };
}
