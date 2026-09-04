import type Dexie from "dexie";

/** Applies migration versions 1 through 20 to the given database. */
export function applyV01ToV20(db: Dexie): void {
  db.version(1).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs: "id, projectId, *tags",
    appSettings: "id",
  });

  db.version(2).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs: "id, projectId, *tags",
    characterRelationships:
      "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
    appSettings: "id",
  });

  db.version(3)
    .stores({
      projects: "id, title, updatedAt",
      chapters: "id, projectId, [projectId+order], updatedAt",
      characters: "id, projectId, name, role",
      locations: "id, projectId, name, parentLocationId",
      timelineEvents: "id, projectId, [projectId+order]",
      styleGuideEntries: "id, projectId, [projectId+order], category",
      worldbuildingDocs:
        "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
      characterRelationships:
        "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
      appSettings: "id",
    })
    .upgrade((tx) =>
      tx
        .table("worldbuildingDocs")
        .toCollection()
        .modify((doc) => {
          if (doc.parentDocId === undefined) doc.parentDocId = null;
          if (doc.order === undefined) doc.order = 0;
        }),
    );

  db.version(4).upgrade((tx) =>
    tx
      .table("characters")
      .toCollection()
      .modify((c) => {
        if (c.pronouns === undefined) c.pronouns = "";
        if (c.personality === undefined) c.personality = "";
        if (c.motivations === undefined) c.motivations = "";
        if (c.internalConflict === undefined) c.internalConflict = "";
        if (c.strengths === undefined) c.strengths = "";
        if (c.weaknesses === undefined) c.weaknesses = "";
        if (c.characterArcs === undefined) c.characterArcs = "";
        if (c.dialogueStyle === undefined) c.dialogueStyle = "";
      }),
  );

  db.version(5).upgrade((tx) =>
    tx
      .table("characters")
      .toCollection()
      .modify((c) => {
        if (c.backstory === undefined) c.backstory = "";
        if (c.notes === undefined) c.notes = "";
      }),
  );

  db.version(6).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs:
      "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
    characterRelationships:
      "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
    outlineColumns: "id, projectId, [projectId+order]",
    outlineCards: "id, projectId, columnId, [columnId+order]",
    appSettings: "id",
  });

  db.version(7).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs:
      "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
    characterRelationships:
      "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
    outlineColumns: "id, projectId, [projectId+order]",
    outlineCards: "id, projectId, columnId, [columnId+order]",
    writingSprints:
      "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
    appSettings: "id",
  });

  db.version(8).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs:
      "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
    characterRelationships:
      "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
    outlineColumns: "id, projectId, [projectId+order]",
    outlineCards: "id, projectId, columnId, [columnId+order]",
    writingSprints:
      "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
    writingSessions:
      "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
    appSettings: "id",
  });

  db.version(9).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs:
      "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
    characterRelationships:
      "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
    outlineColumns: "id, projectId, [projectId+order]",
    outlineCards: "id, projectId, columnId, [columnId+order]",
    outlineGridColumns: "id, projectId, [projectId+order]",
    outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
    outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
    writingSprints:
      "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
    writingSessions:
      "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
    appSettings: "id",
  });

  db.version(10).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs:
      "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
    characterRelationships:
      "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
    outlineColumns: "id, projectId, [projectId+order]",
    outlineCards: "id, projectId, columnId, [columnId+order]",
    outlineGridColumns: "id, projectId, [projectId+order]",
    outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
    outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
    writingSprints:
      "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
    writingSessions:
      "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
    playlistTracks: "id, projectId, [projectId+order]",
    appSettings: "id",
  });

  db.version(11).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs:
      "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
    characterRelationships:
      "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
    outlineColumns: "id, projectId, [projectId+order]",
    outlineCards: "id, projectId, columnId, [columnId+order]",
    outlineGridColumns: "id, projectId, [projectId+order]",
    outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
    outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
    writingSprints:
      "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
    writingSessions:
      "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
    playlistTracks: "id, projectId, [projectId+order]",
    comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
    appSettings: "id",
  });

  db.version(12).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs:
      "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
    characterRelationships:
      "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
    outlineColumns: "id, projectId, [projectId+order]",
    outlineCards: "id, projectId, columnId, [columnId+order]",
    outlineGridColumns: "id, projectId, [projectId+order]",
    outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
    outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
    writingSprints:
      "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
    writingSessions:
      "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
    playlistTracks: "id, projectId, [projectId+order]",
    comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
    appSettings: "id",
    appDictionary: "id",
    projectDictionaries: "id, projectId",
  });

  db.version(13).upgrade((tx) =>
    tx
      .table("appSettings")
      .toCollection()
      .modify((s) => {
        if (s.lastExportedAt === undefined) s.lastExportedAt = null;
      }),
  );

  db.version(14).stores({
    projects: "id, title, updatedAt",
    chapters: "id, projectId, [projectId+order], updatedAt",
    characters: "id, projectId, name, role",
    locations: "id, projectId, name, parentLocationId",
    timelineEvents: "id, projectId, [projectId+order]",
    styleGuideEntries: "id, projectId, [projectId+order], category",
    worldbuildingDocs:
      "id, projectId, *tags, parentDocId, [projectId+parentDocId]",
    characterRelationships:
      "id, projectId, sourceCharacterId, targetCharacterId, [projectId+sourceCharacterId], [projectId+targetCharacterId]",
    outlineColumns: "id, projectId, [projectId+order]",
    outlineCards: "id, projectId, columnId, [columnId+order]",
    outlineGridColumns: "id, projectId, [projectId+order]",
    outlineGridRows: "id, projectId, linkedChapterId, [projectId+order]",
    outlineGridCells: "id, projectId, rowId, columnId, [rowId+columnId]",
    writingSprints:
      "id, projectId, chapterId, status, startedAt, [projectId+startedAt]",
    writingSessions:
      "id, projectId, chapterId, date, [projectId+date], [date+hourOfDay]",
    playlistTracks: "id, projectId, [projectId+order]",
    comments: "id, projectId, chapterId, [chapterId+fromOffset], status",
    chapterSnapshots: "id, chapterId, projectId, [chapterId+createdAt]",
    appSettings: "id",
    appDictionary: "id",
    projectDictionaries: "id, projectId",
  });

  db.version(15).upgrade((tx) =>
    tx
      .table("appSettings")
      .toCollection()
      .modify((s) => {
        if (s.primaryColor === undefined) s.primaryColor = "blue";
        if (s.neutralColor === undefined) s.neutralColor = "zinc";
        if (s.editorWidth === undefined) s.editorWidth = "medium";
        if (s.uiDensity === undefined) s.uiDensity = "comfortable";
      }),
  );

  db.version(16).upgrade((tx) =>
    tx
      .table("appSettings")
      .toCollection()
      .modify((s) => {
        if (s.aiProvider === undefined) s.aiProvider = "openrouter";
        if (s.anthropicApiKey === undefined) s.anthropicApiKey = "";
        if (s.openAiApiKey === undefined) s.openAiApiKey = "";
        if (s.grokApiKey === undefined) s.grokApiKey = "";
        if (s.zaiApiKey === undefined) s.zaiApiKey = "";
      }),
  );

  db.version(17).upgrade((tx) =>
    tx
      .table("appSettings")
      .toCollection()
      .modify((s) => {
        if (s.providerApiKeys === undefined) {
          s.providerApiKeys = {
            openrouter: s.openRouterApiKey ?? "",
            anthropic: s.anthropicApiKey ?? "",
            openai: s.openAiApiKey ?? "",
            grok: s.grokApiKey ?? "",
            zai: s.zaiApiKey ?? "",
          };
        }
        if (s.providerModels === undefined) {
          s.providerModels = {
            openrouter: s.preferredModel ?? "openai/gpt-4o",
            anthropic: "claude-sonnet-4-5-20250929",
            openai: "gpt-4o",
            grok: "grok-3",
            zai: "glm-4.7",
          };
        }
        delete s.openRouterApiKey;
        delete s.anthropicApiKey;
        delete s.openAiApiKey;
        delete s.grokApiKey;
        delete s.zaiApiKey;
        delete s.preferredModel;
      }),
  );

  db.version(18).upgrade((tx) =>
    tx
      .table("appSettings")
      .toCollection()
      .modify((s) => {
        if (s.assistantPrefill === undefined) s.assistantPrefill = "";
      }),
  );

  db.version(19).upgrade((tx) =>
    tx
      .table("appSettings")
      .toCollection()
      .modify((s) => {
        if (s.customSystemPrompt === undefined) s.customSystemPrompt = null;
        if (s.disabledBuiltinTools === undefined) s.disabledBuiltinTools = [];
        if (s.builtinToolOverrides === undefined) s.builtinToolOverrides = {};
        if (s.customTools === undefined) s.customTools = [];
      }),
  );

  db.version(20).upgrade(async (tx) => {
    await tx
      .table("characters")
      .toCollection()
      .modify((c) => {
        if (c.images === undefined) c.images = [];
      });
    await tx
      .table("locations")
      .toCollection()
      .modify((l) => {
        if (l.images === undefined) l.images = [];
      });
  });
}
