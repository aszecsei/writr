import { z } from "zod/v4";
import {
  ChapterIdSchema,
  PlaylistTrackIdSchema,
  ProjectIdSchema,
  WritingSessionIdSchema,
  WritingSprintIdSchema,
} from "./ids";
import { timestamp } from "./shared";

// ─── Writing Sprint ─────────────────────────────────────────────────

const SprintStatusEnum = z.enum(["active", "paused", "completed", "abandoned"]);

export const WritingSprintSchema = z.object({
  id: WritingSprintIdSchema,
  projectId: ProjectIdSchema.nullable().default(null),
  chapterId: ChapterIdSchema.nullable().default(null),
  durationMs: z.number().int().positive(),
  wordCountGoal: z.number().int().nonnegative().nullable().default(null),
  status: SprintStatusEnum,
  startedAt: timestamp,
  pausedAt: timestamp.nullable().default(null),
  endedAt: timestamp.nullable().default(null),
  totalPausedMs: z.number().int().nonnegative().default(0),
  startWordCount: z.number().int().nonnegative(),
  endWordCount: z.number().int().nonnegative().nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type WritingSprint = z.infer<typeof WritingSprintSchema>;

// ─── Writing Session ────────────────────────────────────────────────

export const WritingSessionSchema = z.object({
  id: WritingSessionIdSchema,
  projectId: ProjectIdSchema,
  chapterId: ChapterIdSchema,
  date: z.string(), // YYYY-MM-DD for easy grouping
  hourOfDay: z.number().int().min(0).max(23), // 0-23 for time-of-day analysis
  wordCountStart: z.number().int().nonnegative(),
  wordCountEnd: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type WritingSession = z.infer<typeof WritingSessionSchema>;

// ─── Playlist Track ──────────────────────────────────────────────────

const TrackSourceSchema = z.enum(["youtube"]);
export type TrackSource = z.infer<typeof TrackSourceSchema>;

export const PlaylistTrackSchema = z.object({
  id: PlaylistTrackIdSchema,
  projectId: ProjectIdSchema,
  title: z.string().min(1),
  url: z.string().url(),
  source: TrackSourceSchema,
  thumbnailUrl: z.string().default(""),
  duration: z.number().int().nonnegative().default(0),
  order: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type PlaylistTrack = z.infer<typeof PlaylistTrackSchema>;
