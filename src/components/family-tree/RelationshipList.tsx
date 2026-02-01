import { Panel } from "@xyflow/react";
import { useState } from "react";
import { deleteRelationship, updateRelationship } from "@/db/operations";
import type {
  Character,
  CharacterRelationship,
  RelationshipType,
} from "@/db/schemas";

const typeLabels: Record<string, string> = {
  parent: "Parent",
  child: "Child",
  spouse: "Spouse",
  divorced: "Divorced",
  sibling: "Sibling",
  custom: "Custom",
};

const typeBadgeColors: Record<string, string> = {
  parent:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  child:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  spouse: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  divorced: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  sibling: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  custom:
    "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
};

const relationshipTypes: RelationshipType[] = [
  "parent",
  "child",
  "spouse",
  "divorced",
  "sibling",
  "custom",
];

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

  const badgeClass = typeBadgeColors[rel.type] ?? typeBadgeColors.custom;
  const displayLabel =
    rel.type === "custom" && rel.customLabel
      ? rel.customLabel
      : typeLabels[rel.type];

  if (editing) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="space-y-2">
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value as RelationshipType)}
            className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {relationshipTypes.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </select>
          {editType === "custom" && (
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Custom label..."
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
          {characterName(rel.sourceCharacterId, characters)}
          <span className="mx-1 text-zinc-400">&rarr;</span>
          {characterName(rel.targetCharacterId, characters)}
        </div>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}
        >
          {displayLabel}
        </span>
      </div>
      <div className="ml-2 flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => deleteRelationship(rel.id)}
          className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
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
      className="!m-3 w-72 rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95"
    >
      <h4 className="mb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
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
