"use client";

import { useEffect, useMemo, useState } from "react";
import type { Character, CharacterRole } from "@/db/schemas";

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
      });
    }
  }, [character]);

  const isDirty = useMemo(() => {
    if (!character) return false;
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
      form.notes !== (character.notes ?? "")
    );
  }, [character, form]);

  function setField<K extends CharacterFormField>(
    field: K,
    value: CharacterFormState[K],
  ) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

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
    };
  }

  return { form, setField, isDirty, getUpdatePayload };
}
