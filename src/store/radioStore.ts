import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export type PlaybackState = "stopped" | "playing" | "paused" | "loading";
export type LoopMode = "off" | "all" | "one";

interface RadioState {
  // Playback state
  playbackState: PlaybackState;
  currentTrackId: string | null;
  currentProjectId: string | null;

  // Queue management
  queue: string[];
  queueIndex: number;
  shuffleEnabled: boolean;
  loopMode: LoopMode;
  originalQueue: string[]; // Store original order when shuffle is enabled

  // Volume
  volume: number;
  muted: boolean;

  // Progress
  currentTime: number;
  duration: number;

  // Actions
  play: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleLoopMode: () => void;
  loadPlaylist: (projectId: string, trackIds: string[]) => void;
  playTrack: (trackId: string) => void;

  // Internal setters (for player callbacks)
  setPlaybackState: (state: PlaybackState) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  onTrackEnded: () => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const useRadioStore = create<RadioState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      playbackState: "stopped",
      currentTrackId: null,
      currentProjectId: null,
      queue: [],
      queueIndex: 0,
      shuffleEnabled: false,
      loopMode: "off",
      originalQueue: [],
      volume: 80,
      muted: false,
      currentTime: 0,
      duration: 0,

      play: () =>
        set((s) => {
          if (s.currentTrackId) {
            s.playbackState = "playing";
          }
        }),

      pause: () =>
        set((s) => {
          if (s.playbackState === "playing") {
            s.playbackState = "paused";
          }
        }),

      stop: () =>
        set((s) => {
          s.playbackState = "stopped";
          s.currentTime = 0;
        }),

      next: () => {
        const state = get();
        if (state.queue.length === 0) return;

        const nextIndex = state.queueIndex + 1;
        if (nextIndex >= state.queue.length) {
          // Loop back to start
          set((s) => {
            s.queueIndex = 0;
            s.currentTrackId = s.queue[0];
            s.currentTime = 0;
            s.playbackState = "loading";
          });
        } else {
          set((s) => {
            s.queueIndex = nextIndex;
            s.currentTrackId = s.queue[nextIndex];
            s.currentTime = 0;
            s.playbackState = "loading";
          });
        }
      },

      previous: () => {
        const state = get();
        if (state.queue.length === 0) return;

        // If more than 3 seconds in, restart current track
        if (state.currentTime > 3) {
          set((s) => {
            s.currentTime = 0;
          });
          return;
        }

        const prevIndex = state.queueIndex - 1;
        if (prevIndex < 0) {
          // Loop to end
          set((s) => {
            s.queueIndex = s.queue.length - 1;
            s.currentTrackId = s.queue[s.queue.length - 1];
            s.currentTime = 0;
            s.playbackState = "loading";
          });
        } else {
          set((s) => {
            s.queueIndex = prevIndex;
            s.currentTrackId = s.queue[prevIndex];
            s.currentTime = 0;
            s.playbackState = "loading";
          });
        }
      },

      seekTo: (time: number) =>
        set((s) => {
          s.currentTime = time;
        }),

      setVolume: (volume: number) =>
        set((s) => {
          s.volume = Math.max(0, Math.min(100, volume));
          if (volume > 0) {
            s.muted = false;
          }
        }),

      toggleMute: () =>
        set((s) => {
          s.muted = !s.muted;
        }),

      toggleShuffle: () =>
        set((s) => {
          s.shuffleEnabled = !s.shuffleEnabled;
          if (s.shuffleEnabled) {
            // Enable shuffle: save original queue and shuffle
            s.originalQueue = [...s.queue];
            const currentTrack = s.currentTrackId;
            const shuffled = shuffleArray(s.queue);
            // Move current track to front
            if (currentTrack) {
              const idx = shuffled.indexOf(currentTrack);
              if (idx > 0) {
                shuffled.splice(idx, 1);
                shuffled.unshift(currentTrack);
              }
            }
            s.queue = shuffled;
            s.queueIndex = 0;
          } else {
            // Disable shuffle: restore original queue
            const currentTrack = s.currentTrackId;
            s.queue = [...s.originalQueue];
            s.queueIndex = currentTrack ? s.queue.indexOf(currentTrack) : 0;
            s.originalQueue = [];
          }
        }),

      cycleLoopMode: () =>
        set((s) => {
          const modes: LoopMode[] = ["off", "all", "one"];
          const currentIndex = modes.indexOf(s.loopMode);
          s.loopMode = modes[(currentIndex + 1) % modes.length];
        }),

      loadPlaylist: (projectId: string, trackIds: string[]) =>
        set((s) => {
          s.currentProjectId = projectId;
          s.originalQueue = [...trackIds];
          s.queue = s.shuffleEnabled ? shuffleArray(trackIds) : trackIds;
          s.queueIndex = 0;
          s.currentTrackId = s.queue[0] || null;
          s.currentTime = 0;
          s.duration = 0;
          s.playbackState = s.queue.length > 0 ? "loading" : "stopped";
        }),

      playTrack: (trackId: string) =>
        set((s) => {
          const idx = s.queue.indexOf(trackId);
          if (idx !== -1) {
            s.queueIndex = idx;
            s.currentTrackId = trackId;
            s.currentTime = 0;
            s.playbackState = "loading";
          }
        }),

      // Internal setters
      setPlaybackState: (state: PlaybackState) =>
        set((s) => {
          s.playbackState = state;
        }),

      setCurrentTime: (time: number) =>
        set((s) => {
          s.currentTime = time;
        }),

      setDuration: (duration: number) =>
        set((s) => {
          s.duration = duration;
        }),

      onTrackEnded: () => {
        const state = get();

        // "one" mode: restart current track
        if (state.loopMode === "one") {
          set((s) => {
            s.currentTime = 0;
            s.playbackState = "loading";
          });
          return;
        }

        // "off" mode: stop at end of playlist
        if (state.loopMode === "off") {
          const nextIndex = state.queueIndex + 1;
          if (nextIndex >= state.queue.length) {
            set((s) => {
              s.playbackState = "stopped";
              s.currentTime = 0;
            });
            return;
          }
        }

        // "all" mode or not at end: continue to next track
        get().next();
      },
    })),
    {
      name: "writr-radio",
      // Only persist user preferences, not playback state
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        shuffleEnabled: state.shuffleEnabled,
        loopMode: state.loopMode,
      }),
    },
  ),
);
