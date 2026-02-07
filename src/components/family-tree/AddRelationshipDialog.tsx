import { useState } from "react";
import { BUTTON_CANCEL, BUTTON_PRIMARY } from "@/components/ui/button-styles";
import { Modal } from "@/components/ui/Modal";
import { createRelationship } from "@/db/operations";
import type { Character, RelationshipType } from "@/db/schemas";
import { relationshipTypeList } from "./relationship-config";

export function AddRelationshipDialog({
  projectId,
  characters,
  onClose,
}: {
  projectId: string;
  characters: Character[];
  onClose: () => void;
}) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<RelationshipType>("spouse");
  const [customLabel, setCustomLabel] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!sourceId || !targetId) {
      setError("Please select both characters.");
      return;
    }

    try {
      await createRelationship({
        projectId,
        sourceCharacterId: sourceId,
        targetCharacterId: targetId,
        type,
        customLabel: type === "custom" ? customLabel : "",
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create relationship.",
      );
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Add Relationship
      </h3>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="rel-source"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            From Character
          </label>
          <select
            id="rel-source"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Select character...</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="rel-target"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            To Character
          </label>
          <select
            id="rel-target"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Select character...</option>
            {characters
              .filter((c) => c.id !== sourceId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="rel-type"
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Relationship Type
          </label>
          <select
            id="rel-type"
            value={type}
            onChange={(e) => setType(e.target.value as RelationshipType)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {relationshipTypeList.map((rt) => (
              <option key={rt.value} value={rt.value}>
                {rt.label}
              </option>
            ))}
          </select>
        </div>

        {type === "custom" && (
          <div>
            <label
              htmlFor="rel-custom-label"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              Custom Label
            </label>
            <input
              id="rel-custom-label"
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Mentor, Rival..."
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={BUTTON_CANCEL}>
            Cancel
          </button>
          <button type="submit" className={BUTTON_PRIMARY}>
            Add
          </button>
        </div>
      </form>
    </Modal>
  );
}
