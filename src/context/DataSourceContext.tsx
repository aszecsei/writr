"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * Tells project page components which backing store to read from. The
 * default is `"dexie"` — every existing route uses the user's local
 * IndexedDB. The shared-project guest layout overrides it with
 * `{ kind: "shared", roomUuid }` so the page bodies read from the
 * in-memory `useSharedProjectStore` populated by the project Y.Doc.
 */
export type DataSource =
  | { kind: "dexie" }
  | { kind: "shared"; roomUuid: string };

const DataSourceContext = createContext<DataSource>({ kind: "dexie" });

export function useDataSource(): DataSource {
  return useContext(DataSourceContext);
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
