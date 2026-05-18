"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTtsStore } from "@/store/ttsStore";

/**
 * Chromeless `<audio>` driver for the TTS feature. Mounted once at the app
 * root; reads from `ttsStore` and writes playback time + lifecycle events
 * back into it. The visible controls live in TtsPlayerBar.
 *
 * Chunked playback strategy: as each new audio chunk arrives, we rebuild a
 * single concatenated Blob, swap the audio src, and seek back to where
 * playback had reached. Browsers tolerate naive MP3 concatenation in
 * practice — frame headers re-synchronize at the join. The cost is one
 * brief restart per chunk; for paragraph-sized chunks (~30s each) that's
 * acceptable for v1 and far simpler than wiring up MediaSource.
 */
export function TtsAudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const chunks = useTtsStore((s) => s.chunks);
  const state = useTtsStore((s) => s.state);
  const seekTarget = useTtsStore((s) => s.currentTime);
  const setCurrentTime = useTtsStore((s) => s.setCurrentTime);
  const setDuration = useTtsStore((s) => s.setDuration);
  const setPlaybackState = useTtsStore((s) => s.setPlaybackState);

  // The current concatenated Blob URL. Revoked whenever it's replaced.
  const blobUrlRef = useRef<string | null>(null);

  // Track the last currentTime we wrote into the store so we can detect
  // store-driven seeks (vs. our own onTimeUpdate echoes).
  const lastEchoedTimeRef = useRef(0);

  // Build / rebuild the audio src whenever the chunk list changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (chunks.length === 0) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    const previousTime = audio.currentTime;
    const wasPlaying = !audio.paused;

    const merged = new Blob(chunks, { type: "audio/mpeg" });
    const nextUrl = URL.createObjectURL(merged);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    blobUrlRef.current = nextUrl;
    audio.src = nextUrl;

    // After metadata loads, restore the playhead. If the previous position
    // is past the new media's duration (shouldn't happen since we only ever
    // *grow* the buffer, but be defensive), clamp to end.
    const onLoaded = () => {
      const target = Math.min(previousTime, audio.duration || previousTime);
      audio.currentTime = target;
      lastEchoedTimeRef.current = target;
      if (wasPlaying) {
        void audio.play().catch(() => {
          // Autoplay can fail if the user hasn't interacted; surface as paused.
          setPlaybackState("paused");
        });
      }
    };
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [chunks, setPlaybackState]);

  // Drive play/pause from the store state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state === "playing") {
      void audio.play().catch(() => {
        setPlaybackState("paused");
      });
    } else if (state === "paused" || state === "idle" || state === "error") {
      audio.pause();
      if (state === "idle") {
        audio.currentTime = 0;
      }
    }
  }, [state, setPlaybackState]);

  // Detect external (store-driven) seeks.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(seekTarget - lastEchoedTimeRef.current) > 0.5) {
      audio.currentTime = seekTarget;
      lastEchoedTimeRef.current = seekTarget;
    }
  }, [seekTarget]);

  // Release the last blob URL on unmount.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // useMemo so the inline JSX handlers don't churn refs on every render.
  const handlers = useMemo(
    () => ({
      onTimeUpdate(e: React.SyntheticEvent<HTMLAudioElement>) {
        const t = e.currentTarget.currentTime;
        lastEchoedTimeRef.current = t;
        setCurrentTime(t);
      },
      onDurationChange(e: React.SyntheticEvent<HTMLAudioElement>) {
        const d = e.currentTarget.duration;
        if (Number.isFinite(d)) setDuration(d);
      },
      onEnded() {
        // Only treat "ended" as terminal if all chunks have finished loading.
        // If chunks are still arriving, the audio will be rebuilt on the next
        // chunk and resume.
        const { loadedChunks, totalChunks } = useTtsStore.getState();
        if (totalChunks != null && loadedChunks >= totalChunks) {
          setPlaybackState("idle");
        }
      },
      onError() {
        setPlaybackState("error");
      },
    }),
    [setCurrentTime, setDuration, setPlaybackState],
  );

  return (
    <audio
      ref={audioRef}
      style={{ display: "none" }}
      preload="auto"
      onTimeUpdate={handlers.onTimeUpdate}
      onDurationChange={handlers.onDurationChange}
      onEnded={handlers.onEnded}
      onError={handlers.onError}
    >
      <track kind="captions" />
    </audio>
  );
}
