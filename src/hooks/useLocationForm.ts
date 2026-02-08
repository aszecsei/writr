"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EntityImage, Location } from "@/db/schemas";

interface LocationFormState {
  name: string;
  description: string;
  notes: string;
  parentLocationId: string | null;
  linkedCharacterIds: string[];
  images: EntityImage[];
}

type LocationFormField = keyof LocationFormState;

export function useLocationForm(location: Location | undefined) {
  const [form, setFormState] = useState<LocationFormState>({
    name: "",
    description: "",
    notes: "",
    parentLocationId: null,
    linkedCharacterIds: [],
    images: [],
  });

  useEffect(() => {
    if (location) {
      setFormState({
        name: location.name,
        description: location.description ?? "",
        notes: location.notes ?? "",
        parentLocationId: location.parentLocationId ?? null,
        linkedCharacterIds: location.linkedCharacterIds ?? [],
        images: location.images ?? [],
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
      form.linkedCharacterIds.some((id, i) => id !== locLinkedChars[i]) ||
      JSON.stringify(form.images) !== JSON.stringify(location.images ?? [])
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
    return {
      name: form.name,
      description: form.description,
      notes: form.notes,
      parentLocationId: form.parentLocationId,
      linkedCharacterIds: form.linkedCharacterIds,
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
    addImage,
    removeImage,
    setPrimaryImage,
  };
}
