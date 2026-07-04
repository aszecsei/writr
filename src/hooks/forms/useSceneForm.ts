"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ChapterStatus,
  CharacterId,
  LocationId,
  Scene,
  TimelineMode,
} from "@/db/schemas";

interface SceneFormState {
  title: string;
  status: ChapterStatus;
  povCharacterId: CharacterId | null;
  presentCharacterIds: CharacterId[];
  locationIds: LocationId[];
  timelineMode: TimelineMode;
  strands: string[];
  storyDate: string;
  storyTime: string;
  targetWordCount: number;
  tags: string[];
}

type SceneFormField = keyof SceneFormState;

const EMPTY: SceneFormState = {
  title: "",
  status: "draft",
  povCharacterId: null,
  presentCharacterIds: [],
  locationIds: [],
  timelineMode: "linear",
  strands: [],
  storyDate: "",
  storyTime: "",
  targetWordCount: 0,
  tags: [],
};

function sameList<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function useSceneForm(scene: Scene | undefined) {
  const [form, setFormState] = useState<SceneFormState>(EMPTY);

  useEffect(() => {
    if (scene) {
      setFormState({
        title: scene.title ?? "",
        status: scene.status,
        povCharacterId: scene.povCharacterId ?? null,
        presentCharacterIds: scene.presentCharacterIds ?? [],
        locationIds: scene.locationIds ?? [],
        timelineMode: scene.timelineMode ?? "linear",
        strands: scene.strands ?? [],
        storyDate: scene.storyDate ?? "",
        storyTime: scene.storyTime ?? "",
        targetWordCount: scene.targetWordCount ?? 0,
        tags: scene.tags ?? [],
      });
    }
  }, [scene]);

  const isDirty = useMemo(() => {
    if (!scene) return false;
    return (
      form.title !== (scene.title ?? "") ||
      form.status !== scene.status ||
      form.povCharacterId !== (scene.povCharacterId ?? null) ||
      !sameList(form.presentCharacterIds, scene.presentCharacterIds ?? []) ||
      !sameList(form.locationIds, scene.locationIds ?? []) ||
      form.timelineMode !== (scene.timelineMode ?? "linear") ||
      !sameList(form.strands, scene.strands ?? []) ||
      form.storyDate !== (scene.storyDate ?? "") ||
      form.storyTime !== (scene.storyTime ?? "") ||
      form.targetWordCount !== (scene.targetWordCount ?? 0) ||
      !sameList(form.tags, scene.tags ?? [])
    );
  }, [scene, form]);

  function setField<K extends SceneFormField>(
    field: K,
    value: SceneFormState[K],
  ) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  // Setting the POV character implicitly marks them present, so drop any
  // explicit present-character entry to avoid double-counting.
  const setPovCharacterId = useCallback((id: CharacterId | null) => {
    setFormState((prev) => ({
      ...prev,
      povCharacterId: id,
      presentCharacterIds: id
        ? prev.presentCharacterIds.filter((c) => c !== id)
        : prev.presentCharacterIds,
    }));
  }, []);

  const addPresentCharacterId = useCallback((id: CharacterId) => {
    setFormState((prev) =>
      prev.presentCharacterIds.includes(id)
        ? prev
        : { ...prev, presentCharacterIds: [...prev.presentCharacterIds, id] },
    );
  }, []);

  const removePresentCharacterId = useCallback((id: CharacterId) => {
    setFormState((prev) => ({
      ...prev,
      presentCharacterIds: prev.presentCharacterIds.filter((c) => c !== id),
    }));
  }, []);

  const addLocationId = useCallback((id: LocationId) => {
    setFormState((prev) =>
      prev.locationIds.includes(id)
        ? prev
        : { ...prev, locationIds: [...prev.locationIds, id] },
    );
  }, []);

  const removeLocationId = useCallback((id: LocationId) => {
    setFormState((prev) => ({
      ...prev,
      locationIds: prev.locationIds.filter((l) => l !== id),
    }));
  }, []);

  const addStrand = useCallback((strand: string) => {
    const trimmed = strand.trim();
    if (!trimmed) return;
    setFormState((prev) =>
      prev.strands.includes(trimmed)
        ? prev
        : { ...prev, strands: [...prev.strands, trimmed] },
    );
  }, []);

  const removeStrand = useCallback((strand: string) => {
    setFormState((prev) => ({
      ...prev,
      strands: prev.strands.filter((s) => s !== strand),
    }));
  }, []);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setFormState((prev) =>
      prev.tags.includes(trimmed)
        ? prev
        : { ...prev, tags: [...prev.tags, trimmed] },
    );
  }, []);

  const removeTag = useCallback((tag: string) => {
    setFormState((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }, []);

  function getUpdatePayload() {
    return {
      title: form.title,
      status: form.status,
      povCharacterId: form.povCharacterId,
      presentCharacterIds: form.presentCharacterIds,
      locationIds: form.locationIds,
      timelineMode: form.timelineMode,
      strands: form.strands,
      storyDate: form.storyDate,
      storyTime: form.storyTime,
      targetWordCount: form.targetWordCount,
      tags: form.tags,
    };
  }

  return {
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
  };
}
