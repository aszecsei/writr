import { z } from "zod/v4";

// ─── Branded Entity ID Schemas ──────────────────────────────────────
//
// Each entity's primary key gets a distinct brand so the type system
// catches accidental cross-entity ID assignment (e.g. passing a chapter
// id where a project id is expected). FK fields below reuse the
// destination entity's brand so a `Chapter.projectId` is structurally
// identical to a `Project.id`.

export const ProjectIdSchema = z.uuid().brand<"ProjectId">();
export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const ChapterIdSchema = z.uuid().brand<"ChapterId">();
export type ChapterId = z.infer<typeof ChapterIdSchema>;

export const CharacterIdSchema = z.uuid().brand<"CharacterId">();
export type CharacterId = z.infer<typeof CharacterIdSchema>;

export const LocationIdSchema = z.uuid().brand<"LocationId">();
export type LocationId = z.infer<typeof LocationIdSchema>;

export const TimelineEventIdSchema = z.uuid().brand<"TimelineEventId">();
export type TimelineEventId = z.infer<typeof TimelineEventIdSchema>;

export const StyleGuideEntryIdSchema = z.uuid().brand<"StyleGuideEntryId">();
export type StyleGuideEntryId = z.infer<typeof StyleGuideEntryIdSchema>;

export const GuardrailEntryIdSchema = z.uuid().brand<"GuardrailEntryId">();
export type GuardrailEntryId = z.infer<typeof GuardrailEntryIdSchema>;

export const WorldbuildingDocIdSchema = z.uuid().brand<"WorldbuildingDocId">();
export type WorldbuildingDocId = z.infer<typeof WorldbuildingDocIdSchema>;

export const CharacterRelationshipIdSchema = z
  .uuid()
  .brand<"CharacterRelationshipId">();
export type CharacterRelationshipId = z.infer<
  typeof CharacterRelationshipIdSchema
>;

export const OutlineGridColumnIdSchema = z
  .uuid()
  .brand<"OutlineGridColumnId">();
export type OutlineGridColumnId = z.infer<typeof OutlineGridColumnIdSchema>;

export const OutlineGridRowIdSchema = z.uuid().brand<"OutlineGridRowId">();
export type OutlineGridRowId = z.infer<typeof OutlineGridRowIdSchema>;

export const OutlineGridCellIdSchema = z.uuid().brand<"OutlineGridCellId">();
export type OutlineGridCellId = z.infer<typeof OutlineGridCellIdSchema>;

export const WritingSprintIdSchema = z.uuid().brand<"WritingSprintId">();
export type WritingSprintId = z.infer<typeof WritingSprintIdSchema>;

export const WritingSessionIdSchema = z.uuid().brand<"WritingSessionId">();
export type WritingSessionId = z.infer<typeof WritingSessionIdSchema>;

export const PlaylistTrackIdSchema = z.uuid().brand<"PlaylistTrackId">();
export type PlaylistTrackId = z.infer<typeof PlaylistTrackIdSchema>;

export const CommentIdSchema = z.uuid().brand<"CommentId">();
export type CommentId = z.infer<typeof CommentIdSchema>;

export const ChapterSnapshotIdSchema = z.uuid().brand<"ChapterSnapshotId">();
export type ChapterSnapshotId = z.infer<typeof ChapterSnapshotIdSchema>;

export const ProjectDictionaryIdSchema = z
  .uuid()
  .brand<"ProjectDictionaryId">();
export type ProjectDictionaryId = z.infer<typeof ProjectDictionaryIdSchema>;

export const ChapterSummaryIdSchema = z.uuid().brand<"ChapterSummaryId">();

export const AgentDefinitionIdSchema = z.uuid().brand<"AgentDefinitionId">();
export type AgentDefinitionId = z.infer<typeof AgentDefinitionIdSchema>;

export const EntityImageIdSchema = z.uuid().brand<"EntityImageId">();
export type EntityImageId = z.infer<typeof EntityImageIdSchema>;

export const IndexedChunkIdSchema = z.uuid().brand<"IndexedChunkId">();
export type IndexedChunkId = z.infer<typeof IndexedChunkIdSchema>;

export const SceneIdSchema = z.uuid().brand<"SceneId">();
export type SceneId = z.infer<typeof SceneIdSchema>;

export const SavedPromptIdSchema = z.uuid().brand<"SavedPromptId">();
export type SavedPromptId = z.infer<typeof SavedPromptIdSchema>;

export const BrainstormSetupIdSchema = z.uuid().brand<"BrainstormSetupId">();
export type BrainstormSetupId = z.infer<typeof BrainstormSetupIdSchema>;

export const BrainstormIdeaIdSchema = z.uuid().brand<"BrainstormIdeaId">();
export type BrainstormIdeaId = z.infer<typeof BrainstormIdeaIdSchema>;
