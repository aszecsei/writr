"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * Tells project page components which backing store to read from, and how
 * to build links back into the project. The default is `"dexie"` — every
 * existing route uses the user's local IndexedDB. The shared-project guest
 * layout overrides it with `{ kind: "shared", roomUuid }` so the page
 * bodies read from the in-memory `useSharedProjectStore` populated by the
 * project Y.Doc and link within the `/shared/[roomUuid]` tree.
 */
export type DataSource =
  | { kind: "dexie" }
  | { kind: "shared"; roomUuid: string };

const DataSourceContext = createContext<DataSource>({ kind: "dexie" });

export function useDataSource(): DataSource {
  return useContext(DataSourceContext);
}

/** True for the read-only shared-project guest view. */
export function useReadOnly(): boolean {
  return useDataSource().kind === "shared";
}

/** URL prefix (no trailing slash) for links within the given project. */
export function useProjectHref(projectId: string): string {
  const source = useDataSource();
  return source.kind === "shared"
    ? `/shared/${source.roomUuid}/projects/${projectId}`
    : `/projects/${projectId}`;
}

export function DataSourceProvider({
  source,
  children,
}: {
  source: DataSource;
  children: ReactNode;
}): ReactNode {
  const value = useMemo(() => source, [source]);
  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}
