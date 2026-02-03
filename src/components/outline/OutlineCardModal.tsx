"use client";

import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { deleteOutlineCard, updateOutlineCard } from "@/db/operations";
import type { OutlineCard, OutlineCardColor } from "@/db/schemas";
import {
  useCharactersByProject,
  useLocationsByProject,
} from "@/hooks/useBibleEntries";
import { useChaptersByProject } from "@/hooks/useChapter";

const COLORS: { value: OutlineCardColor; label: string; className: string }[] =
  [
    {
      value: "yellow",
      label: "Yellow",
      className: "bg-amber-300 dark:bg-amber-500",
    },
    {
      value: "pink",
      label: "Pink",
      className: "bg-pink-300 dark:bg-pink-500",
    },
    {
      value: "blue",
      label: "Blue",
      className: "bg-sky-300 dark:bg-sky-500",
    },
    {
      value: "green",
      label: "Green",
      className: "bg-emerald-300 dark:bg-emerald-500",
    },
    {
      value: "orange",
      label: "Orange",
      className: "bg-orange-300 dark:bg-orange-500",
    },
    {
      value: "purple",
      label: "Purple",
      className: "bg-violet-300 dark:bg-violet-500",
    },
    {
      value: "white",
      label: "White",
      className: "bg-white border border-zinc-300 dark:bg-zinc-300",
    },
  ];

interface OutlineCardModalProps {
  card: OutlineCard;
  projectId: string;
  onClose: () => void;
}

export function OutlineCardModal({
  card,
  projectId,
  onClose,
}: OutlineCardModalProps) {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content);
  const [color, setColor] = useState<OutlineCardColor>(card.color);
  const [linkedChapterIds, setLinkedChapterIds] = useState<string[]>(
    card.linkedChapterIds,
  );
  const [linkedCharacterIds, setLinkedCharacterIds] = useState<string[]>(
    card.linkedCharacterIds,
  );
  const [linkedLocationIds, setLinkedLocationIds] = useState<string[]>(
    card.linkedLocationIds,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const chapters = useChaptersByProject(projectId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);

  async function handleSave() {
    if (!title.trim()) return;
    await updateOutlineCard(card.id, {
      title: title.trim(),
      content,
      color,
      linkedChapterIds,
      linkedCharacterIds,
      linkedLocationIds,
    });
    onClose();
  }

  async function handleDelete() {
    await deleteOutlineCard(card.id);
    onClose();
  }

  function addLinkedChapter(id: string) {
    if (id && !linkedChapterIds.includes(id)) {
      setLinkedChapterIds([...linkedChapterIds, id]);
    }
  }

  function addLinkedCharacter(id: string) {
    if (id && !linkedCharacterIds.includes(id)) {
      setLinkedCharacterIds([...linkedCharacterIds, id]);
    }
  }

  function addLinkedLocation(id: string) {
    if (id && !linkedLocationIds.includes(id)) {
      setLinkedLocationIds([...linkedLocationIds, id]);
    }
  }

  return (
    <Modal onClose={handleSave} maxWidth="max-w-lg">
      <div className="space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Card title"
          className="w-full bg-transparent text-lg font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />

        {/* Color picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Color
          </span>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className={`h-5 w-5 rounded-full ${c.className} ${
                  color === c.value
                    ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-zinc-100"
                    : ""
                }`}
                aria-label={c.label}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Notes..."
          rows={4}
          className="w-full resize-none rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
        />

        {/* Linked Chapters */}
        <LinkedSection
          label="Chapters"
          linkedIds={linkedChapterIds}
          items={(chapters ?? []).map((c) => ({ id: c.id, label: c.title }))}
          onAdd={addLinkedChapter}
          onRemove={(id) =>
            setLinkedChapterIds(linkedChapterIds.filter((x) => x !== id))
          }
        />

        {/* Linked Characters */}
        <LinkedSection
          label="Characters"
          linkedIds={linkedCharacterIds}
          items={(characters ?? []).map((c) => ({ id: c.id, label: c.name }))}
          onAdd={addLinkedCharacter}
          onRemove={(id) =>
            setLinkedCharacterIds(linkedCharacterIds.filter((x) => x !== id))
          }
        />

        {/* Linked Locations */}
        <LinkedSection
          label="Locations"
          linkedIds={linkedLocationIds}
          items={(locations ?? []).map((l) => ({ id: l.id, label: l.name }))}
          onAdd={addLinkedLocation}
          onRemove={(id) =>
            setLinkedLocationIds(linkedLocationIds.filter((x) => x !== id))
          }
        />

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 dark:text-red-400">
                Delete this card?
              </span>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LinkedSection({
  label,
  linkedIds,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  linkedIds: string[];
  items: { id: string; label: string }[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const available = items.filter((i) => !linkedIds.includes(i.id));

  return (
    <div>
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="mt-1 flex flex-wrap gap-1">
        {linkedIds.map((id) => {
          const item = items.find((i) => i.id === id);
          if (!item) return null;
          return (
            <span
              key={id}
              className="flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
            >
              {item.label}
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={10} />
              </button>
            </span>
          );
        })}
      </div>
      {available.length > 0 && (
        <select
          onChange={(e) => {
            onAdd(e.target.value);
            e.target.value = "";
          }}
          defaultValue=""
          className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <option value="" disabled>
            Link {label.toLowerCase()}...
          </option>
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
