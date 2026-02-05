"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Location } from "@/db/schemas";

interface LocationFormState {
  name: string;
  description: string;
  notes: string;
  parentLocationId: string | null;
  linkedCharacterIds: string[];
}

type LocationFormField = keyof LocationFormState;

export function useLocationForm(location: Location | undefined) {
  const [form, setFormState] = useState<LocationFormState>({
    name: "",
    description: "",
    notes: "",
    parentLocationId: null,
    linkedCharacterIds: [],
  });

  useEffect(() => {
    if (location) {
      setFormState({
        name: location.name,
        description: location.description ?? "",
        notes: location.notes ?? "",
        parentLocationId: location.parentLocationId ?? null,
        linkedCharacterIds: location.linkedCharacterIds ?? [],
      });
    }
  }, [location]);

  const isDirty = useMemo(() => {
    if (!location) return false;
    const locLinkedChars = location.linkedCharacterIds ?? [];
    return (
      form.name !== location.name ||
      form.description !== (location.description ?? "") ||
      form.notes !== (location.notes ?? "") ||
      form.parentLocationId !== (location.parentLocationId ?? null) ||
      form.linkedCharacterIds.length !== locLinkedChars.length ||
      form.linkedCharacterIds.some((id, i) => id !== locLinkedChars[i])
    );
  }, [location, form]);

  function setField<K extends LocationFormField>(
    field: K,
    value: LocationFormState[K],
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

  function getUpdatePayload() {
    return {
      name: form.name,
      description: form.description,
      notes: form.notes,
      parentLocationId: form.parentLocationId,
      linkedCharacterIds: form.linkedCharacterIds,
    };
  }

  return {
    form,
    setField,
    isDirty,
    getUpdatePayload,
    addLinkedCharacterId,
    removeLinkedCharacterId,
  };
}
