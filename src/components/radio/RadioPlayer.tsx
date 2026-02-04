"use client";

import { type SyntheticEvent, useEffect, useRef } from "react";
import ReactPlayer from "react-player";
import { usePlaylistTrack } from "@/hooks/usePlaylistEntries";
import { useRadioStore } from "@/store/radioStore";

/**
 * Chromeless audio player that controls playback via radioStore.
 * Mounted at root level (AppProviders) to persist across navigation.
 */
export function RadioPlayer() {
  const playerRef = useRef<HTMLVideoElement>(null);

  const currentTrackId = useRadioStore((s) => s.currentTrackId);
  const playbackState = useRadioStore((s) => s.playbackState);
  const volume = useRadioStore((s) => s.volume);
  const muted = useRadioStore((s) => s.muted);
  const currentTime = useRadioStore((s) => s.currentTime);

  const setPlaybackState = useRadioStore((s) => s.setPlaybackState);
  const setCurrentTime = useRadioStore((s) => s.setCurrentTime);
  const setDuration = useRadioStore((s) => s.setDuration);
  const onTrackEnded = useRadioStore((s) => s.onTrackEnded);

  const track = usePlaylistTrack(currentTrackId);

  // Track the last seek time to detect external seeks
  const lastSeekRef = useRef<number>(0);

  // Handle external seek requests
  useEffect(() => {
    if (playerRef.current && Math.abs(currentTime - lastSeekRef.current) > 1) {
      playerRef.current.currentTime = currentTime;
      lastSeekRef.current = currentTime;
    }
  }, [currentTime]);

  if (!track) {
    return null;
  }

  const isPlaying = playbackState === "playing" || playbackState === "loading";

  function handleTimeUpdate(e: SyntheticEvent<HTMLVideoElement>) {
    const time = e.currentTarget.currentTime;
    lastSeekRef.current = time;
    setCurrentTime(time);
  }

  function handleDurationChange(e: SyntheticEvent<HTMLVideoElement>) {
    setDuration(e.currentTarget.duration);
  }

  return (
    <div style={{ display: "none" }}>
      <ReactPlayer
        ref={playerRef}
        src={track.url}
        playing={isPlaying}
        volume={volume / 100}
        muted={muted}
        width={0}
        height={0}
        onReady={() => {
          if (playbackState === "loading") {
            setPlaybackState("playing");
          }
        }}
        onStart={() => {
          setPlaybackState("playing");
        }}
        onPlay={() => {
          setPlaybackState("playing");
        }}
        onPause={() => {
          if (playbackState !== "stopped") {
            setPlaybackState("paused");
          }
        }}
        onEnded={() => {
          onTrackEnded();
        }}
        onError={() => {
          setPlaybackState("stopped");
        }}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        config={{
          youtube: {
            // Disable related videos at end
            rel: 0,
            // Disable annotations
            iv_load_policy: 3,
          },
        }}
      />
    </div>
  );
}
