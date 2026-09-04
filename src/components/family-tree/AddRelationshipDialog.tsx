import { useState } from "react";
import { DialogFooter } from "@/components/ui/DialogFooter";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/form-styles";
import { Modal } from "@/components/ui/Modal";
import { createRelationship } from "@/db/operations";
import type {
  Character,
  CharacterId,
  ProjectId,
  RelationshipType,
} from "@/db/schemas";
import { relationshipTypeList } from "./relationship-config";

export function AddRelationshipDialog({
  projectId,
  characters,
  onClose,
}: {
  projectId: ProjectId;
  characters: Character[];
  onClose: () => void;
}) {
  const [sourceId, setSourceId] = useState<CharacterId | "">("");
  const [targetId, setTargetId] = useState<CharacterId | "">("");
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
    <Modal onClose={onClose} title="Add Relationship">
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="rel-source" className={LABEL_CLASS}>
            From Character
          </label>
          <select
            id="rel-source"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value as CharacterId | "")}
            className={INPUT_CLASS}
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
          <label htmlFor="rel-target" className={LABEL_CLASS}>
            To Character
          </label>
          <select
            id="rel-target"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value as CharacterId | "")}
            className={INPUT_CLASS}
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
          <label htmlFor="rel-type" className={LABEL_CLASS}>
            Relationship Type
          </label>
          <select
            id="rel-type"
            value={type}
            onChange={(e) => setType(e.target.value as RelationshipType)}
            className={INPUT_CLASS}
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
            <label htmlFor="rel-custom-label" className={LABEL_CLASS}>
              Custom Label
            </label>
            <input
              id="rel-custom-label"
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Mentor, Rival..."
              className={INPUT_CLASS}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="pt-2">
          <DialogFooter onCancel={onClose} submitLabel="Add" />
        </div>
      </form>
    </Modal>
  );
}
