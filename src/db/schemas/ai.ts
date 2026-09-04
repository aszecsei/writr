import { z } from "zod/v4";
import {
  AgentDefinitionIdSchema,
  ChapterIdSchema,
  CommentIdSchema,
  ProjectIdSchema,
  SavedPromptIdSchema,
} from "./ids";
import { timestamp } from "./shared";

// ─── AI Provider ────────────────────────────────────────────────────

export const AiProviderEnum = z.enum([
  "openrouter",
  "anthropic",
  "openai",
  "grok",
  "zai",
  "google",
  "vertex",
]);
export type AiProvider = z.infer<typeof AiProviderEnum>;

// ─── Reasoning Effort ────────────────────────────────────────────────

export const ReasoningEffortEnum = z.enum([
  "xhigh",
  "high",
  "medium",
  "low",
  "minimal",
  "none",
]);
export type ReasoningEffort = z.infer<typeof ReasoningEffortEnum>;

// ─── Agents ─────────────────────────────────────────────────────────

/**
 * All agent kinds: chat-mode user-facing agents and user-created agents.
 */
const AgentKindEnum = z.enum([
  // User-facing chat agents (selectable from AiPanel dropdown).
  "spark",
  "scene",
  "reader",
  "editor",
  "character-dialogue",
  "brainstorm",
  "chat",
  "beta-reader",
  "outline-architect",
  "worldbuilder",
  "orchestrator-chat",
  "researcher",
  "prose-writer",
  // User-created via Manage Agents.
  "user",
]);
export type AgentKind = z.infer<typeof AgentKindEnum>;

const AgentModelOverrideSchema = z.object({
  provider: AiProviderEnum,
  model: z.string().min(1),
  reasoningEffort: ReasoningEffortEnum.optional(),
});
export type AgentModelOverride = z.infer<typeof AgentModelOverrideSchema>;

/**
 * Unified agent definition row. Backs the built-in chat agents and any
 * user-created agents (kind="user"). Fields are seeded from bundled defaults
 * when a built-in agent is first written; "Reset to defaults" rewrites them.
 *
 * Built-in agents are global (projectId=null) and singleton-per-kind. User
 * agents may be project-scoped or global; multiple `kind="user"` rows are
 * allowed.
 *
 * Distinct from the runner-side `Agent` interface in `src/lib/ai/agents/types`
 * — that's an ephemeral per-invocation runnable; this is the persistent
 * definition the runner constructs from.
 */
export const AgentDefinitionSchema = z.object({
  id: AgentDefinitionIdSchema,
  kind: AgentKindEnum,
  /** null = global (built-ins always null; users can opt project-scoped). */
  projectId: ProjectIdSchema.nullable().default(null),
  name: z.string().min(1),
  description: z.string().default(""),
  systemPrompt: z.string().min(1),
  /** Tool ids the agent may use. Empty = no tools (text-only). */
  allowedToolIds: z.array(z.string()).default([]),
  modelOverride: AgentModelOverrideSchema.nullable().default(null),
  /** Optional assistant prefill; piped through to the runner. */
  assistantPrefill: z.string().default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

// ─── Saved Prompts ──────────────────────────────────────────────────

export const SavedPromptSchema = z.object({
  id: SavedPromptIdSchema,
  // null = global (available in every project); otherwise scoped to a project.
  projectId: ProjectIdSchema.nullable().default(null),
  title: z.string().min(1),
  body: z.string().default(""),
  // Non-null = a bundled built-in prompt, keyed by this stable identifier. Such
  // rows are seeded on boot, non-deletable, and resettable to their default
  // (mirrors built-in agents). null = a user-created prompt.
  builtinKey: z.string().nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type SavedPrompt = z.infer<typeof SavedPromptSchema>;

// ─── Comment ─────────────────────────────────────────────────────────

const CommentColorEnum = z.enum(["yellow", "blue", "green", "red", "purple"]);
export type CommentColor = z.infer<typeof CommentColorEnum>;

const CommentStatusEnum = z.enum(["active", "orphaned", "resolved"]);
export type CommentStatus = z.infer<typeof CommentStatusEnum>;

export const CommentSchema = z.object({
  id: CommentIdSchema,
  projectId: ProjectIdSchema,
  chapterId: ChapterIdSchema,
  content: z.string().default(""),
  color: CommentColorEnum.default("yellow"),
  fromOffset: z.number().int().nonnegative(),
  toOffset: z.number().int().nonnegative(), // from === to for positioned (point) comments
  anchorText: z.string().default(""), // Empty for positioned (point) comments
  status: CommentStatusEnum.default("active"),
  resolvedAt: timestamp.nullable().default(null),
  // Optional: present on comments authored during a collab session.
  // Display name + caret color of the author at creation time.
  author: z.string().optional(),
  authorColor: z.string().optional(),
  // Threading. null = root comment; non-null = reply attached to that root.
  // Replies are flat: a reply's own parentCommentId always points at a root,
  // never at another reply. Replies inherit their position (fromOffset /
  // toOffset / anchorText) from the root at creation time and stay in sync
  // when the root moves.
  parentCommentId: CommentIdSchema.nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Comment = z.infer<typeof CommentSchema>;
