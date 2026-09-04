"use client";

import { Loader2, Pause, Play, X } from "lucide-react";
import { formatPlaybackTime } from "@/lib/format-time";
import { useTtsStore } from "@/store/ttsStore";

/**
 * Persistent mini player rendered at the bottom of AppShell while a chapter
 * is being read aloud. Hidden when `state === "idle"`.
 */
export function TtsPlayerBar() {
  const state = useTtsStore((s) => s.state);
  const chapterTitle = useTtsStore((s) => s.chapterTitle);
  const currentTime = useTtsStore((s) => s.currentTime);
  const duration = useTtsStore((s) => s.duration);
  const loadedChunks = useTtsStore((s) => s.loadedChunks);
  const totalChunks = useTtsStore((s) => s.totalChunks);
  const errorMessage = useTtsStore((s) => s.errorMessage);

  const play = useTtsStore((s) => s.play);
  const pause = useTtsStore((s) => s.pause);
  const stop = useTtsStore((s) => s.stop);
  const seekTo = useTtsStore((s) => s.seekTo);

  if (state === "idle") return null;

  const isPlaying = state === "playing";
  const isLoading = state === "loading";
  const isError = state === "error";
  const showLoadingCounter =
    totalChunks != null && loadedChunks < totalChunks && !isError;

  return (
    <section
      className="flex items-center gap-3 border-t border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Read-aloud player"
    >
      <button
        type="button"
        onClick={isPlaying ? pause : play}
        disabled={isLoading && loadedChunks === 0}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
        title={isPlaying ? "Pause" : "Play"}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isLoading && loadedChunks === 0 ? (
          <Loader2 size={18} className="animate-spin" />
        ) : isPlaying ? (
          <Pause size={18} />
        ) : (
          <Play size={18} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {isError ? "Read-aloud failed" : (chapterTitle ?? "Reading aloud…")}
          </span>
          {showLoadingCounter && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {loadedChunks}/{totalChunks} chunks
            </span>
          )}
        </div>

        {isError ? (
          <div className="mt-0.5 truncate text-[11px] text-rose-600 dark:text-rose-400">
            {errorMessage ?? "Unknown error"}
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <span className="w-9 text-right text-[10px] tabular-nums text-neutral-400">
              {formatPlaybackTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={Math.min(currentTime, duration || currentTime)}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neutral-500"
              aria-label="Playback position"
            />
            <span className="w-9 text-[10px] tabular-nums text-neutral-400">
              {formatPlaybackTime(duration)}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={stop}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        title="Stop"
        aria-label="Stop read-aloud"
      >
        <X size={18} />
      </button>
    </section>
  );
}
