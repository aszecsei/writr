import { create } from "zustand";
import type { ChapterId } from "@/db/schemas";
import { chunkTextForTts } from "@/lib/tts/chunk";
import { hashTtsText } from "@/lib/tts/extract";

type TtsPlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

interface StartArgs {
  chapterId: ChapterId;
  chapterTitle: string;
  text: string;
  apiKey: string;
  provider: "openrouter";
  model: string;
  voice: string;
}

interface TtsState {
  state: TtsPlaybackState;
  chapterId: ChapterId | null;
  chapterTitle: string | null;
  chunks: Blob[];
  totalChunks: number | null;
  loadedChunks: number;
  currentTime: number;
  duration: number;
  errorMessage: string | null;

  /**
   * In-session audio cache keyed by `${chapterId}:${contentHash}:${voice}:${model}`.
   * Plain dictionary rather than a Map so the store can be cleared with a
   * normal set() call. Survives navigation, dies on refresh.
   */
  cache: Record<string, Blob[]>;

  /**
   * AbortController for the in-flight chunk fetch loop. Stop() aborts it so
   * the user can cancel a long generation midway.
   */
  abortController: AbortController | null;

  startReadAloud(args: StartArgs): Promise<void>;
  play(): void;
  pause(): void;
  stop(): void;
  seekTo(time: number): void;
  setCurrentTime(time: number): void;
  setDuration(duration: number): void;
  setPlaybackState(state: TtsPlaybackState): void;
}

function cacheKey(
  chapterId: ChapterId,
  text: string,
  voice: string,
  model: string,
): string {
  return `${chapterId}:${hashTtsText(text)}:${voice}:${model}`;
}

export const useTtsStore = create<TtsState>()((set, get) => ({
  state: "idle",
  chapterId: null,
  chapterTitle: null,
  chunks: [],
  totalChunks: null,
  loadedChunks: 0,
  currentTime: 0,
  duration: 0,
  errorMessage: null,
  cache: {},
  abortController: null,

  async startReadAloud(args) {
    const { chapterId, chapterTitle, text, apiKey, provider, model, voice } =
      args;

    // Cancel any in-flight generation before starting a new one.
    get().abortController?.abort();

    const key = cacheKey(chapterId, text, voice, model);
    const cached = get().cache[key];

    if (cached?.length) {
      set({
        state: "playing",
        chapterId,
        chapterTitle,
        chunks: cached,
        totalChunks: cached.length,
        loadedChunks: cached.length,
        currentTime: 0,
        duration: 0,
        errorMessage: null,
        abortController: null,
      });
      return;
    }

    const pieces = chunkTextForTts(text);
    if (pieces.length === 0) {
      set({
        state: "error",
        errorMessage: "Nothing to read aloud.",
      });
      return;
    }

    const controller = new AbortController();
    set({
      state: "loading",
      chapterId,
      chapterTitle,
      chunks: [],
      totalChunks: pieces.length,
      loadedChunks: 0,
      currentTime: 0,
      duration: 0,
      errorMessage: null,
      abortController: controller,
    });

    try {
      for (const piece of pieces) {
        if (controller.signal.aborted) return;

        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            action: "tts",
            apiKey,
            provider,
            model,
            voice,
            text: piece,
            format: "mp3",
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const msg =
            err.upstream?.message ??
            err.details ??
            err.error ??
            `TTS request failed (${response.status})`;
          throw new Error(msg);
        }

        const blob = await response.blob();
        if (controller.signal.aborted) return;

        set((s) => {
          const nextChunks = [...s.chunks, blob];
          return {
            chunks: nextChunks,
            loadedChunks: nextChunks.length,
            // Flip to "playing" on the first chunk so the engine picks up src.
            state: s.state === "loading" ? "playing" : s.state,
          };
        });
      }

      // Cache the assembled blobs for the rest of the session.
      const finalChunks = get().chunks;
      set((s) => ({
        cache: { ...s.cache, [key]: finalChunks },
        abortController: null,
      }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof Error ? error.message : "TTS request failed";
      set({
        state: "error",
        errorMessage: message,
        abortController: null,
      });
    }
  },

  play() {
    set((s) => ({
      state:
        s.chunks.length > 0 && (s.state === "paused" || s.state === "loading")
          ? "playing"
          : s.state === "idle" || s.state === "error"
            ? s.state
            : "playing",
    }));
  },

  pause() {
    set((s) => (s.state === "playing" ? { state: "paused" as const } : {}));
  },

  stop() {
    get().abortController?.abort();
    set({
      state: "idle",
      chapterId: null,
      chapterTitle: null,
      chunks: [],
      totalChunks: null,
      loadedChunks: 0,
      currentTime: 0,
      duration: 0,
      errorMessage: null,
      abortController: null,
    });
  },

  seekTo(time) {
    set({ currentTime: time });
  },

  setCurrentTime(time) {
    set({ currentTime: time });
  },

  setDuration(duration) {
    set({ duration });
  },

  setPlaybackState(state) {
    set({ state });
  },
}));
