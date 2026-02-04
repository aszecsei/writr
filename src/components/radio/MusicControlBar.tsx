"use client";

import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { usePlaylistTrack } from "@/hooks/usePlaylistEntries";
import { type LoopMode, useRadioStore } from "@/store/radioStore";

function formatTime(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function LoopButton({
  loopMode,
  onClick,
}: {
  loopMode: LoopMode;
  onClick: () => void;
}) {
  const isActive = loopMode !== "off";
  const Icon = loopMode === "one" ? Repeat1 : Repeat;
  const title =
    loopMode === "off"
      ? "Loop off"
      : loopMode === "all"
        ? "Loop all"
        : "Loop one";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded p-1.5 transition-colors ${
        isActive
          ? "text-zinc-900 dark:text-zinc-100"
          : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      }`}
      title={title}
    >
      <Icon size={12} />
    </button>
  );
}

export function MusicControlBar() {
  const currentTrackId = useRadioStore((s) => s.currentTrackId);
  const playbackState = useRadioStore((s) => s.playbackState);
  const volume = useRadioStore((s) => s.volume);
  const muted = useRadioStore((s) => s.muted);
  const shuffleEnabled = useRadioStore((s) => s.shuffleEnabled);
  const loopMode = useRadioStore((s) => s.loopMode);
  const currentTime = useRadioStore((s) => s.currentTime);
  const duration = useRadioStore((s) => s.duration);

  const play = useRadioStore((s) => s.play);
  const pause = useRadioStore((s) => s.pause);
  const next = useRadioStore((s) => s.next);
  const previous = useRadioStore((s) => s.previous);
  const setVolume = useRadioStore((s) => s.setVolume);
  const toggleMute = useRadioStore((s) => s.toggleMute);
  const toggleShuffle = useRadioStore((s) => s.toggleShuffle);
  const cycleLoopMode = useRadioStore((s) => s.cycleLoopMode);
  const seekTo = useRadioStore((s) => s.seekTo);

  const track = usePlaylistTrack(currentTrackId);

  // Don't render if no track is loaded
  if (!currentTrackId) {
    return null;
  }

  const isPlaying = playbackState === "playing" || playbackState === "loading";
  const isLoading = playbackState === "loading";

  return (
    <div className="mb-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Now Playing */}
      <div className="mb-2 truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {track?.title || "Loading..."}
      </div>

      {/* Progress bar */}
      <div className="mb-2 flex items-center gap-2">
        <span className="w-8 text-right text-[10px] tabular-nums text-zinc-400">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-200 dark:bg-zinc-700 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-500"
        />
        <span className="w-8 text-[10px] tabular-nums text-zinc-400">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Transport */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={previous}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="Previous"
          >
            <SkipBack size={14} />
          </button>
          <button
            type="button"
            onClick={isPlaying ? pause : play}
            disabled={isLoading}
            className="rounded p-1.5 text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title="Next"
          >
            <SkipForward size={14} />
          </button>
        </div>

        {/* Shuffle, Loop & Volume */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleShuffle}
            className={`rounded p-1.5 transition-colors ${
              shuffleEnabled
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            }`}
            title={shuffleEnabled ? "Shuffle on" : "Shuffle off"}
          >
            <Shuffle size={12} />
          </button>
          <LoopButton loopMode={loopMode} onClick={cycleLoopMode} />
          <button
            type="button"
            onClick={toggleMute}
            className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 w-14 cursor-pointer appearance-none rounded-full bg-zinc-200 dark:bg-zinc-700 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-500"
          />
        </div>
      </div>
    </div>
  );
}
