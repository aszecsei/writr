"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "@/db/database";
import { AppSettingsSchema } from "@/db/schemas";
import { isManuscriptDocument } from "@/lib/binder/tree";
import { APP_SETTINGS_ID } from "@/lib/constants";

export interface AppStats {
  projectCount: number;
  chapterCount: number;
  characterCount: number;
  locationCount: number;
  totalWordCount: number;
  lastExportedAt: string | null;
  storageSizeBytes: number | null;
  storageQuotaBytes: number | null;
}

export function useAppStats(): AppStats | undefined {
  const [storageSizeBytes, setStorageSizeBytes] = useState<number | null>(null);
  const [storageQuotaBytes, setStorageQuotaBytes] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage.estimate().then((estimate) => {
        setStorageSizeBytes(estimate.usage ?? null);
        setStorageQuotaBytes(estimate.quota ?? null);
      });
    }
  }, []);

  const stats = useLiveQuery(async () => {
    const [projectCount, characterCount, locationCount, chapters, rawSettings] =
      await Promise.all([
        db.projects.count(),
        db.characters.count(),
        db.locations.count(),
        db.chapters.toArray(),
        db.appSettings.get(APP_SETTINGS_ID),
      ]);

    // Scratchpad documents and separators are not part of the manuscript, so
    // they don't count toward the chapter count or the total word count.
    const manuscriptChapters = chapters.filter(isManuscriptDocument);
    const chapterCount = manuscriptChapters.length;
    const totalWordCount = manuscriptChapters.reduce(
      (sum, ch) => sum + (ch.wordCount ?? 0),
      0,
    );
    const settings = rawSettings ? AppSettingsSchema.parse(rawSettings) : null;

    return {
      projectCount,
      chapterCount,
      characterCount,
      locationCount,
      totalWordCount,
      lastExportedAt: settings?.lastExportedAt ?? null,
    };
  });

  if (!stats) return undefined;

  return {
    ...stats,
    storageSizeBytes,
    storageQuotaBytes,
  };
}
