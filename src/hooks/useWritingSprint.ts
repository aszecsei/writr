"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useRef } from "react";
import { db } from "@/db/database";
import {
  createSprint,
  endSprint,
  getActiveSprint,
  pauseSprint,
  resumeSprint,
} from "@/db/operations";
import { useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";
import { useSprintStore } from "@/store/sprintStore";

export function useWritingSprint() {
  const activeSprint = useLiveQuery(() => getActiveSprint(), []);
  const wordCount = useEditorStore((s) => s.wordCount);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeDocumentId = useEditorStore((s) => s.activeDocumentId);
  const activeDocumentType = useEditorStore((s) => s.activeDocumentType);

  const {
    setActiveSprint,
    updateTimer,
    setWordsWritten,
    reset,
    closeConfigModal,
  } = useSprintStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startWordCountRef = useRef<number>(0);

  // Sync active sprint to store
  useEffect(() => {
    if (activeSprint) {
      setActiveSprint(
        activeSprint.id,
        activeSprint.status === "active",
        activeSprint.status === "paused",
      );
      startWordCountRef.current = activeSprint.startWordCount;
    } else {
      reset();
    }
  }, [activeSprint, setActiveSprint, reset]);

  // Timer tick effect
  useEffect(() => {
    if (!activeSprint || activeSprint.status !== "active") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const tick = () => {
      const startedAt = new Date(activeSprint.startedAt).getTime();
      const elapsed = Date.now() - startedAt - activeSprint.totalPausedMs;
      const remaining = Math.max(0, activeSprint.durationMs - elapsed);

      updateTimer(elapsed, remaining);

      // Auto-complete when timer expires
      if (remaining <= 0) {
        endSprint(activeSprint.id, wordCount, false);
      }
    };

    tick(); // Immediate tick
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeSprint, updateTimer, wordCount]);

  // Update words written
  useEffect(() => {
    if (activeSprint) {
      const written = Math.max(0, wordCount - activeSprint.startWordCount);
      setWordsWritten(written);
    }
  }, [activeSprint, wordCount, setWordsWritten]);

  const start = useCallback(
    async (durationMs: number, wordCountGoal: number | null = null) => {
      const chapterId =
        activeDocumentType === "chapter" ? activeDocumentId : null;
      await createSprint({
        durationMs,
        startWordCount: wordCount,
        projectId: activeProjectId,
        chapterId,
        wordCountGoal,
      });
      closeConfigModal();
    },
    [
      activeProjectId,
      activeDocumentId,
      activeDocumentType,
      wordCount,
      closeConfigModal,
    ],
  );

  const pause = useCallback(async () => {
    if (activeSprint) {
      await pauseSprint(activeSprint.id);
    }
  }, [activeSprint]);

  const resume = useCallback(async () => {
    if (activeSprint) {
      await resumeSprint(activeSprint.id);
    }
  }, [activeSprint]);

  const end = useCallback(
    async (abandoned = false) => {
      if (activeSprint) {
        await endSprint(activeSprint.id, wordCount, abandoned);
      }
    },
    [activeSprint, wordCount],
  );

  return {
    activeSprint,
    start,
    pause,
    resume,
    end,
  };
}

export function useActiveSprintQuery() {
  return useLiveQuery(
    () => db.writingSprints.where("status").anyOf(["active", "paused"]).first(),
    [],
  );
}
