import { Panel } from "@xyflow/react";
import { useState } from "react";
import { deleteRelationship, updateRelationship } from "@/db/operations";
import type {
  Character,
  CharacterRelationship,
  RelationshipType,
} from "@/db/schemas";
import {
  relationshipTypeConfigs,
  relationshipTypeList,
} from "./relationship-config";

function characterName(id: string, characters: Character[]): string {
  return characters.find((c) => c.id === id)?.name ?? "Unknown";
}

function RelationshipRow({
  rel,
  characters,
}: {
  rel: CharacterRelationship;
  characters: Character[];
}) {
  const [editing, setEditing] = useState(false);
  const [editType, setEditType] = useState<RelationshipType>(rel.type);
  const [editLabel, setEditLabel] = useState(rel.customLabel);

  async function handleSave() {
    await updateRelationship(rel.id, {
      type: editType,
      customLabel: editType === "custom" ? editLabel : "",
    });
    setEditing(false);
  }

  const config =
    relationshipTypeConfigs[rel.type] ?? relationshipTypeConfigs.custom;
  const displayLabel =
    rel.type === "custom" && rel.customLabel ? rel.customLabel : config.label;

  if (editing) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="space-y-2">
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value as RelationshipType)}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {relationshipTypeList.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {editType === "custom" && (
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Custom label..."
              className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-primary-600 px-2 py-1 text-xs text-white dark:bg-primary-500 dark:text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded px-2 py-1 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-neutral-900 dark:text-neutral-100">
          {characterName(rel.sourceCharacterId, characters)}
          <span className="mx-1 text-neutral-400">&rarr;</span>
          {characterName(rel.targetCharacterId, characters)}
        </div>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${config.badgeColor}`}
        >
          {displayLabel}
        </span>
      </div>
      <div className="ml-2 flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => deleteRelationship(rel.id)}
          className="rounded px-1.5 py-0.5 text-[10px] text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function RelationshipList({
  relationships,
  characters,
}: {
  relationships: CharacterRelationship[];
  characters: Character[];
}) {
  if (relationships.length === 0) return null;

  return (
    <Panel
      position="top-right"
      className="!m-3 w-72 rounded-lg border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95"
    >
      <h4 className="mb-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
        Relationships ({relationships.length})
      </h4>
      <div className="max-h-[400px] space-y-2 overflow-y-auto">
        {relationships.map((rel) => (
          <RelationshipRow key={rel.id} rel={rel} characters={characters} />
        ))}
      </div>
    </Panel>
  );
}
