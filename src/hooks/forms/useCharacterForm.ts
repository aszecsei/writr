"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Character, CharacterRole, EntityImage } from "@/db/schemas";

interface CharacterFormState {
  name: string;
  role: CharacterRole;
  pronouns: string;
  aliasesInput: string;
  description: string;
  personality: string;
  motivations: string;
  internalConflict: string;
  strengths: string;
  weaknesses: string;
  characterArcs: string;
  dialogueStyle: string;
  backstory: string;
  notes: string;
  linkedCharacterIds: string[];
  linkedLocationIds: string[];
  images: EntityImage[];
}

type CharacterFormField = keyof CharacterFormState;

export function useCharacterForm(character: Character | undefined) {
  const [form, setFormState] = useState<CharacterFormState>({
    name: "",
    role: "supporting",
    pronouns: "",
    aliasesInput: "",
    description: "",
    personality: "",
    motivations: "",
    internalConflict: "",
    strengths: "",
    weaknesses: "",
    characterArcs: "",
    dialogueStyle: "",
    backstory: "",
    notes: "",
    linkedCharacterIds: [],
    linkedLocationIds: [],
    images: [],
  });

  useEffect(() => {
    if (character) {
      setFormState({
        name: character.name,
        role: character.role,
        pronouns: character.pronouns ?? "",
        aliasesInput: (character.aliases ?? []).join(", "),
        description: character.description ?? "",
        personality: character.personality ?? "",
        motivations: character.motivations ?? "",
        internalConflict: character.internalConflict ?? "",
        strengths: character.strengths ?? "",
        weaknesses: character.weaknesses ?? "",
        characterArcs: character.characterArcs ?? "",
        dialogueStyle: character.dialogueStyle ?? "",
        backstory: character.backstory ?? "",
        notes: character.notes ?? "",
        linkedCharacterIds: character.linkedCharacterIds ?? [],
        linkedLocationIds: character.linkedLocationIds ?? [],
        images: character.images ?? [],
      });
    }
  }, [character]);

  const isDirty = useMemo(() => {
    if (!character) return false;
    const charLinkedChars = character.linkedCharacterIds ?? [];
    const charLinkedLocs = character.linkedLocationIds ?? [];
    return (
      form.name !== character.name ||
      form.role !== character.role ||
      form.pronouns !== (character.pronouns ?? "") ||
      form.aliasesInput !== (character.aliases ?? []).join(", ") ||
      form.description !== (character.description ?? "") ||
      form.personality !== (character.personality ?? "") ||
      form.motivations !== (character.motivations ?? "") ||
      form.internalConflict !== (character.internalConflict ?? "") ||
      form.strengths !== (character.strengths ?? "") ||
      form.weaknesses !== (character.weaknesses ?? "") ||
      form.characterArcs !== (character.characterArcs ?? "") ||
      form.dialogueStyle !== (character.dialogueStyle ?? "") ||
      form.backstory !== (character.backstory ?? "") ||
      form.notes !== (character.notes ?? "") ||
      form.linkedCharacterIds.length !== charLinkedChars.length ||
      form.linkedCharacterIds.some((id, i) => id !== charLinkedChars[i]) ||
      form.linkedLocationIds.length !== charLinkedLocs.length ||
      form.linkedLocationIds.some((id, i) => id !== charLinkedLocs[i]) ||
      JSON.stringify(form.images) !== JSON.stringify(character.images ?? [])
    );
  }, [character, form]);

  function setField<K extends CharacterFormField>(
    field: K,
    value: CharacterFormState[K],
  ) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  const addLinkedCharacterId = useCallback((id: string) => {
    setFormState((prev) =>
      prev.linkedCharacterIds.includes(id)
        ? prev
        : { ...prev, linkedCharacterIds: [...prev.linkedCharacterIds, id] },
    );
  }, []);

  const removeLinkedCharacterId = useCallback((id: string) => {
    setFormState((prev) => ({
      ...prev,
      linkedCharacterIds: prev.linkedCharacterIds.filter((cid) => cid !== id),
    }));
  }, []);

  const addLinkedLocationId = useCallback((id: string) => {
    setFormState((prev) =>
      prev.linkedLocationIds.includes(id)
        ? prev
        : { ...prev, linkedLocationIds: [...prev.linkedLocationIds, id] },
    );
  }, []);

  const removeLinkedLocationId = useCallback((id: string) => {
    setFormState((prev) => ({
      ...prev,
      linkedLocationIds: prev.linkedLocationIds.filter((lid) => lid !== id),
    }));
  }, []);

  const addImage = useCallback((image: EntityImage) => {
    setFormState((prev) => ({
      ...prev,
      images: [...prev.images, image],
    }));
  }, []);

  const removeImage = useCallback((imageId: string) => {
    setFormState((prev) => ({
      ...prev,
      images: prev.images.filter((img) => img.id !== imageId),
    }));
  }, []);

  const setPrimaryImage = useCallback((imageId: string) => {
    setFormState((prev) => ({
      ...prev,
      images: prev.images.map((img) => ({
        ...img,
        isPrimary: img.id === imageId,
      })),
    }));
  }, []);

  function getUpdatePayload() {
    const aliases = form.aliasesInput
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    return {
      name: form.name,
      role: form.role,
      pronouns: form.pronouns,
      aliases,
      description: form.description,
      personality: form.personality,
      motivations: form.motivations,
      internalConflict: form.internalConflict,
      strengths: form.strengths,
      weaknesses: form.weaknesses,
      characterArcs: form.characterArcs,
      dialogueStyle: form.dialogueStyle,
      backstory: form.backstory,
      notes: form.notes,
      linkedCharacterIds: form.linkedCharacterIds,
      linkedLocationIds: form.linkedLocationIds,
      images: form.images,
    };
  }

  return {
    form,
    setField,
    isDirty,
    getUpdatePayload,
    addLinkedCharacterId,
    removeLinkedCharacterId,
    addLinkedLocationId,
    removeLinkedLocationId,
    addImage,
    removeImage,
    setPrimaryImage,
  };
}
