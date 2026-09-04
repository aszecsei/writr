"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessageId } from "@/components/ai/chat/types";

/**
 * Loading/error/abort lifecycle for one agent run, plus the per-tool
 * approval gate (Approve/Deny on a pending tool call inline in
 * `MessageList`, distinct from the bubbled-up sub-agent gates in
 * `usePendingGates`).
 */
export function useAgentRun() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestStartRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [pendingToolApproval, setPendingToolApproval] = useState(false);

  // Per-tool approval gate. Maps a pending tool message's id to the resolver
  // for its approval promise. The Approve/Deny buttons in MessageList look
  // up the entry by tool message id and resolve it.
  const toolApprovalResolversRef = useRef<
    Map<ChatMessageId, (approved: boolean) => void>
  >(new Map());

  useEffect(() => {
    if (!loading) {
      requestStartRef.current = null;
      return;
    }
    const interval = setInterval(() => {
      if (requestStartRef.current != null) {
        setElapsedMs(Date.now() - requestStartRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  function awaitToolApproval(toolMessageId: ChatMessageId): Promise<boolean> {
    setPendingToolApproval(true);
    return new Promise<boolean>((resolve) => {
      toolApprovalResolversRef.current.set(toolMessageId, resolve);
    });
  }

  function resolveToolApproval(
    toolMessageId: ChatMessageId,
    approved: boolean,
  ) {
    const resolver = toolApprovalResolversRef.current.get(toolMessageId);
    if (resolver) {
      toolApprovalResolversRef.current.delete(toolMessageId);
      resolver(approved);
    }
    if (toolApprovalResolversRef.current.size === 0) {
      setPendingToolApproval(false);
    }
  }

  /** Mark the moment the actual run (post-setup) begins, resetting the timer. */
  function markRunStarted() {
    requestStartRef.current = Date.now();
    setElapsedMs(0);
  }

  /**
   * Shared wrapper for the four run entry points (submit, edit, regenerate,
   * continue): sets loading state, mints the abort controller, and handles
   * the common error/cleanup paths around `prepare` — which does the
   * handler-specific work and calls `runSelectedAgent(signal)`.
   */
  async function runWithLoading(
    prepare: (signal: AbortSignal) => Promise<void>,
  ) {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await prepare(controller.signal);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      setPendingToolApproval(false);
      abortControllerRef.current = null;
    }
  }

  /**
   * Abort the in-flight run and resolve any pending tool-call approvals as
   * denied so the runner can unwind cleanly. The runner's own abort check
   * then bails out before executing the tool.
   */
  function abort() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    for (const resolver of toolApprovalResolversRef.current.values()) {
      resolver(false);
    }
    toolApprovalResolversRef.current.clear();
    setLoading(false);
    setPendingToolApproval(false);
    setError(null);
  }

  return {
    loading,
    error,
    setError,
    elapsedMs,
    pendingToolApproval,
    awaitToolApproval,
    resolveToolApproval,
    markRunStarted,
    runWithLoading,
    abort,
  };
}
