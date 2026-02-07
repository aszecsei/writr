"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Music, Pause, Play, Trash2 } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { DragHandle } from "@/components/bible/DragHandle";
import {
  createPlaylistTrack,
  deletePlaylistTrack,
  reorderPlaylistTracks,
} from "@/db/operations";
import type { PlaylistTrack } from "@/db/schemas";
import { usePlaylistByProject } from "@/hooks/usePlaylistEntries";
import { fetchTrackMetadata } from "@/lib/radio/metadata";
import { parseTrackUrl } from "@/lib/radio/url-parser";
import { useRadioStore } from "@/store/radioStore";

export default function PlaylistPage() {
  const params = useParams<{ projectId: string }>();
  const tracks = usePlaylistByProject(params.projectId);
  const [newUrl, setNewUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimistic local state for drag reordering
  const [localTracks, setLocalTracks] = useState(tracks ?? []);
  const previousTracks = useRef(localTracks);
  const isDragging = useRef(false);

  // Sync Dexie live query -> local state (suppressed during drag)
  useEffect(() => {
    if (tracks && !isDragging.current) {
      setLocalTracks(tracks);
    }
  }, [tracks]);

  const currentTrackId = useRadioStore((s) => s.currentTrackId);
  const playbackState = useRadioStore((s) => s.playbackState);
  const loadPlaylist = useRadioStore((s) => s.loadPlaylist);
  const playTrack = useRadioStore((s) => s.playTrack);
  const play = useRadioStore((s) => s.play);
  const pause = useRadioStore((s) => s.pause);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newUrl.trim()) return;

    setError(null);
    setIsAdding(true);

    try {
      const parsed = parseTrackUrl(newUrl.trim());
      if (!parsed) {
        setError("Unsupported URL. Please enter a YouTube link.");
        setIsAdding(false);
        return;
      }

      const metadata = await fetchTrackMetadata(parsed.url);

      await createPlaylistTrack({
        projectId: params.projectId,
        title: metadata.title,
        url: parsed.url,
        source: parsed.source,
        thumbnailUrl: metadata.thumbnailUrl,
        duration: metadata.duration,
      });

      setNewUrl("");
    } catch (err) {
      console.error("Failed to add track:", err);
      setError("Failed to add track. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  function handlePlayAll() {
    if (!localTracks || localTracks.length === 0) return;
    loadPlaylist(
      params.projectId,
      localTracks.map((t) => t.id),
    );
  }

  function handleTrackClick(track: PlaylistTrack) {
    const isCurrentTrack = currentTrackId === track.id;
    const isPlaying = playbackState === "playing";

    if (isCurrentTrack) {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    } else {
      // Load playlist if not already loaded, then play this track
      if (localTracks) {
        loadPlaylist(
          params.projectId,
          localTracks.map((t) => t.id),
        );
      }
      playTrack(track.id);
    }
  }

  async function handleDelete(trackId: string) {
    await deletePlaylistTrack(trackId);
  }

  return (
    <div className="mx-auto max-w-editor px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Playlist
          </h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Add YouTube tracks to listen to while writing.
          </p>
        </div>
        {localTracks && localTracks.length > 0 && (
          <button
            type="button"
            onClick={handlePlayAll}
            className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
          >
            <Play size={14} />
            Play All
          </button>
        )}
      </div>

      <form onSubmit={handleAdd} className="mt-6">
        <div className="flex gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Paste YouTube URL..."
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <button
            type="submit"
            disabled={!newUrl.trim() || isAdding}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </form>

      <div className="mt-6 space-y-2">
        {localTracks?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <Music size={24} className="text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              No tracks yet. Add a YouTube URL above.
            </p>
          </div>
        )}
        {localTracks && localTracks.length > 0 && (
          <DragDropProvider
            onDragStart={() => {
              isDragging.current = true;
              previousTracks.current = localTracks;
            }}
            onDragOver={(event) => {
              setLocalTracks((items) => move(items, event));
            }}
            onDragEnd={async (event) => {
              isDragging.current = false;
              if (event.canceled) {
                setLocalTracks(previousTracks.current);
                return;
              }
              const orderedIds = localTracks.map((t) => t.id);
              await reorderPlaylistTracks(orderedIds);
            }}
          >
            <div className="space-y-2">
              {localTracks.map((track, index) => (
                <SortableTrackCard
                  key={track.id}
                  track={track}
                  index={index}
                  isPlaying={
                    currentTrackId === track.id && playbackState === "playing"
                  }
                  isCurrent={currentTrackId === track.id}
                  onClick={() => handleTrackClick(track)}
                  onDelete={() => handleDelete(track.id)}
                />
              ))}
            </div>
          </DragDropProvider>
        )}
      </div>
    </div>
  );
}

function SortableTrackCard({
  track,
  index,
  isPlaying,
  isCurrent,
  onClick,
  onDelete,
}: {
  track: PlaylistTrack;
  index: number;
  isPlaying: boolean;
  isCurrent: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: track.id,
    index,
  });

  return (
    <div
      ref={ref}
      className={`group flex items-center gap-2 rounded-lg border px-3 py-3 transition-colors ${
        isDragSource
          ? "opacity-50 ring-2 ring-neutral-300 dark:ring-neutral-600"
          : ""
      } ${
        isCurrent
          ? "border-neutral-400 bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800"
          : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/50"
      }`}
    >
      {/* Drag Handle */}
      <DragHandle ref={handleRef} />

      {/* Thumbnail */}
      <button
        type="button"
        onClick={onClick}
        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700"
      >
        {track.thumbnailUrl ? (
          <Image
            src={track.thumbnailUrl}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <Music size={20} className="text-neutral-400" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {isPlaying ? (
            <Pause size={20} className="text-white" />
          ) : (
            <Play size={20} className="text-white" />
          )}
        </div>
      </button>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onClick}
          className="block w-full text-left"
        >
          <h3 className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {track.title}
          </h3>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            YouTube
          </p>
        </button>
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded p-1.5 text-neutral-400 opacity-0 transition-all hover:bg-neutral-200 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-neutral-700"
        title="Delete track"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
