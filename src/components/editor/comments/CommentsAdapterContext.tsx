"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { CommentsAdapter } from "@/lib/comments/adapter";

const CommentsAdapterContext = createContext<CommentsAdapter | null>(null);

export function CommentsAdapterProvider({
  adapter,
  children,
}: {
  adapter: CommentsAdapter;
  children: ReactNode;
}) {
  return (
    <CommentsAdapterContext.Provider value={adapter}>
      {children}
    </CommentsAdapterContext.Provider>
  );
}

export function useCommentsAdapter(): CommentsAdapter {
  const adapter = useContext(CommentsAdapterContext);
  if (!adapter) {
    throw new Error(
      "useCommentsAdapter must be used inside <CommentsAdapterProvider>",
    );
  }
  return adapter;
}
