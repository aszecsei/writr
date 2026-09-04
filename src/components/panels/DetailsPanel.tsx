"use client";

import { X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { updateScene } from "@/db/operations";
import type {
  CharacterId,
  LocationId,
  SceneId,
  TimelineMode,
} from "@/db/schemas";
import {
  useCharactersByProject,
  useLocationsByProject,
} from "@/hooks/data/source";
import { useChapter } from "@/hooks/data/useChapter";
import { useActiveProject } from "@/hooks/data/useProject";
import {
  useProjectStrands,
  useScene,
  useScenesByChapter,
} from "@/hooks/data/useScene";
import { useSceneForm } from "@/hooks/forms/useSceneForm";
import { getTerm } from "@/lib/terminology";
import { selectActiveChapterId, useEditorStore } from "@/store/editorStore";
import { useProjectStore } from "@/store/projectStore";

const TIMELINE_MODES: { value: TimelineMode; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "flashback", label: "Flashback" },
  { value: "flashforward", label: "Flashforward" },
  { value: "dream", label: "Dream sequence" },
  { value: "vision", label: "Vision" },
  { value: "other", label: "Other" },
];

const inputClass =
  "mt-1 block w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100";
const labelClass =
  "block text-[11px] font-medium text-neutral-600 dark:text-neutral-400";

function Chips({
  items,
  onRemove,
  color,
}: {
  items: { key: string; label: string }[];
  onRemove: (key: string) => void;
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it.key}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}
        >
          {it.label}
          <button
            type="button"
            onClick={() => onRemove(it.key)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

export function DetailsPanel() {
  const chapterId = useEditorStore(selectActiveChapterId);
  const activeSceneId = useEditorStore((s) => s.activeSceneId);
  const requestSceneScroll = useEditorStore((s) => s.requestSceneScroll);
  const projectId = useProjectStore((s) => s.activeProjectId);
  const projectMode = useActiveProject()?.mode ?? null;

  const chapter = useChapter(chapterId);
  const scenes = useScenesByChapter(chapterId);
  // Bind to the caret's scene; fall back to the chapter's core scene.
  const targetSceneId = (activeSceneId ??
    scenes?.[0]?.id ??
    null) as SceneId | null;
  const scene = useScene(targetSceneId);
  const characters = useCharactersByProject(projectId);
  const locations = useLocationsByProject(projectId);
  const strandSuggestions = useProjectStrands(projectId);

  const {
    form,
    setField,
    isDirty,
    getUpdatePayload,
    setPovCharacterId,
    addPresentCharacterId,
    removePresentCharacterId,
    addLocationId,
    removeLocationId,
    addStrand,
    removeStrand,
    addTag,
    removeTag,
  } = useSceneForm(scene);

  // Debounced autosave: persist metadata shortly after the last edit.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: form is the change trigger; getUpdatePayload reads the latest form
  useEffect(() => {
    if (!scene || !isDirty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void updateScene(
        scene.id,
        getUpdatePayload() as Parameters<typeof updateScene>[1],
      );
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [scene, isDirty, form]);

  const [strandInput, setStrandInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const characterMap = new Map((characters ?? []).map((c) => [c.id, c.name]));
  const locationMap = new Map((locations ?? []).map((l) => [l.id, l.name]));
  // The POV character is implicitly present: keep them out of both the present
  // list and the add dropdown so they can't be added redundantly.
  const presentCharacterIds = form.presentCharacterIds.filter(
    (id) => id !== form.povCharacterId,
  );
  const availableChars = (characters ?? []).filter(
    (c) =>
      !form.presentCharacterIds.includes(c.id) && c.id !== form.povCharacterId,
  );
  const availableLocs = (locations ?? []).filter(
    (l) => !form.locationIds.includes(l.id),
  );

  const sceneLabel = (index: number, title: string) =>
    title.trim() || `${getTerm(projectMode, "scene")} ${index + 1}`;

  function onStrandKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && strandInput.trim()) {
      e.preventDefault();
      addStrand(strandInput);
      setStrandInput("");
    }
  }
  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    }
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50 dark:bg-neutral-950">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!chapter ? (
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            Open a {getTerm(projectMode, "chapter").toLowerCase()} to see its
            details.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Chapter overview */}
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {chapter.title}
              </p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                {(scenes?.length ?? 0).toLocaleString()}{" "}
                {getTerm(
                  projectMode,
                  (scenes?.length ?? 0) === 1 ? "scene" : "scenes",
                ).toLowerCase()}
                {" · "}
                {chapter.wordCount.toLocaleString()} words
              </p>
            </div>

            {/* Scene list */}
            {(scenes?.length ?? 0) > 1 && (
              <div className="space-y-1">
                {(scenes ?? []).map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => requestSceneScroll(s.id)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[11px] transition-colors ${
                      s.id === targetSceneId
                        ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="truncate">{sceneLabel(i, s.title)}</span>
                    <span className="ml-2 shrink-0 tabular-nums text-neutral-400 dark:text-neutral-500">
                      {s.wordCount.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Active scene metadata */}
            {scene ? (
              <div className="space-y-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  {getTerm(projectMode, "scene")} metadata
                </p>

                <div>
                  <label className={labelClass} htmlFor="scene-title">
                    Title
                  </label>
                  <input
                    id="scene-title"
                    value={form.title}
                    onChange={(e) => setField("title", e.target.value)}
                    placeholder={`Untitled ${getTerm(projectMode, "scene").toLowerCase()}`}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass} htmlFor="scene-status">
                      Status
                    </label>
                    <select
                      id="scene-status"
                      value={form.status}
                      onChange={(e) =>
                        setField("status", e.target.value as typeof form.status)
                      }
                      className={inputClass}
                    >
                      <option value="draft">Draft</option>
                      <option value="revised">Revised</option>
                      <option value="final">Final</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="scene-timeline">
                      Timeline
                    </label>
                    <select
                      id="scene-timeline"
                      value={form.timelineMode}
                      onChange={(e) =>
                        setField("timelineMode", e.target.value as TimelineMode)
                      }
                      className={inputClass}
                    >
                      {TIMELINE_MODES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* POV character */}
                <div>
                  <label className={labelClass} htmlFor="scene-pov">
                    POV character
                  </label>
                  <select
                    id="scene-pov"
                    value={form.povCharacterId ?? ""}
                    onChange={(e) =>
                      setPovCharacterId(
                        e.target.value ? (e.target.value as CharacterId) : null,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">— none —</option>
                    {(characters ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Present characters */}
                <div>
                  <p className={labelClass}>Present characters</p>
                  <Chips
                    items={presentCharacterIds.map((id) => ({
                      key: id,
                      label: characterMap.get(id) ?? "Unknown",
                    }))}
                    onRemove={(id) =>
                      removePresentCharacterId(id as CharacterId)
                    }
                    color="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  />
                  {availableChars.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value)
                          addPresentCharacterId(e.target.value as CharacterId);
                      }}
                      className={inputClass}
                    >
                      <option value="">Add a character…</option>
                      {availableChars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Locations */}
                <div>
                  <p className={labelClass}>Locations</p>
                  <Chips
                    items={form.locationIds.map((id) => ({
                      key: id,
                      label: locationMap.get(id) ?? "Unknown",
                    }))}
                    onRemove={(id) => removeLocationId(id as LocationId)}
                    color="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  />
                  {availableLocs.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value)
                          addLocationId(e.target.value as LocationId);
                      }}
                      className={inputClass}
                    >
                      <option value="">Add a location…</option>
                      {availableLocs.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Strands (with autocomplete) */}
                <div>
                  <p className={labelClass}>Strands</p>
                  <Chips
                    items={form.strands.map((s) => ({ key: s, label: s }))}
                    onRemove={removeStrand}
                    color="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  />
                  <input
                    list="strand-suggestions"
                    value={strandInput}
                    onChange={(e) => setStrandInput(e.target.value)}
                    onKeyDown={onStrandKey}
                    placeholder="Add a strand (e.g. 1943)…"
                    className={inputClass}
                  />
                  <datalist id="strand-suggestions">
                    {strandSuggestions
                      .filter((s) => !form.strands.includes(s))
                      .map((s) => (
                        <option key={s} value={s} />
                      ))}
                  </datalist>
                </div>

                {/* Story date / time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass} htmlFor="scene-date">
                      Story date
                    </label>
                    <input
                      id="scene-date"
                      value={form.storyDate}
                      onChange={(e) => setField("storyDate", e.target.value)}
                      placeholder="e.g. 1943-06-01"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="scene-time">
                      Story time
                    </label>
                    <input
                      id="scene-time"
                      value={form.storyTime}
                      onChange={(e) => setField("storyTime", e.target.value)}
                      placeholder="e.g. dusk"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Word counts */}
                <div>
                  <label className={labelClass} htmlFor="scene-target">
                    Target word count
                  </label>
                  <input
                    id="scene-target"
                    type="number"
                    min={0}
                    value={form.targetWordCount || ""}
                    onChange={(e) =>
                      setField(
                        "targetWordCount",
                        Math.max(0, Number(e.target.value) || 0),
                      )
                    }
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                    {scene.wordCount.toLocaleString()} words written
                    {form.targetWordCount > 0 &&
                      ` of ${form.targetWordCount.toLocaleString()}`}
                  </p>
                </div>

                {/* Tags (nestable via "/") */}
                <div>
                  <p className={labelClass}>Tags</p>
                  <Chips
                    items={form.tags.map((t) => ({ key: t, label: t }))}
                    onRemove={removeTag}
                    color="bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                  />
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKey}
                    placeholder="Add a tag (e.g. arc/rising-action)…"
                    className={inputClass}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
