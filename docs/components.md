# Components

Components live under `src/components/` and are organized by feature area. Before creating new UI, **check `src/components/ui/`** for existing primitives.

## Feature directories

- **`agents/`** — `AgentEditorBody`: the full-page agent-definition editor behind the `/agents/definitions` routes. `AgentsPageBody`: the Agent list (Global / Project) body.
- **`ai/`** — AI chat panel: `AiPanel`, `AgentSelector`, `MessageList`, `MarkdownMessage`, `ToolCallMessage`, `ProposedEditCard`, `DelegatedAgentCard`, `PendingGatesBar`, `PromptInput`, `SparkOptions`, `PromptInspectorDialog`, `ImageAttachmentPicker`. Sub-agent delegation renders nested transcripts (`DelegatedAgentCard`) and user gates (`PendingGatesBar`).
- **`bible/`** — Story-bible building blocks: `AddImageDialog`, `ImageGallery`, `ImageLightbox`, `CollapsibleSection`, `DragHandle`, `RoleBadge`, `SortableTimelineCard`.
- **`collab/`** — Real-time collaboration UI: `ShareSessionButton`, `ShareDialog`, `CollabBanner`, `DisplayNamePrompt`, `ApproveJoinDialog`, `ManageParticipantsDialog`, `GuestSessionShell`, `CollabProseEditor`. All gated on `NEXT_PUBLIC_COLLAB_URL`.
- **`dashboard/`** — Project picker: `ProjectGrid`, `ProjectCard`, `CreateProjectDialog`, `EditProjectDialog`, `DeleteProjectDialog`, `ProjectFormFields`.
- **`editor/`** — TipTap editor (see `docs/editor.md`).
- **`export/`** — Export dialogs and preview UI for the manuscript pipeline (`src/lib/export/`).
- **`family-tree/`** — XYFlow-based character relationship diagram: `CharacterNode`, `RelationshipEdge`, `RelationshipList`, `AddRelationshipDialog`.
- **`layout/`** — App shell, topbar, sidebar.
- **`outline/`** — Outline grid: `OutlineGrid`, `OutlineGridRow`, `OutlineGridCell`, `OutlineGridHeader`, `OutlineGridToolbar`, `OutlineGridContextMenu`, `OutlineTemplateDialog`, `StatusBadge`.
- **`preview-card/`** — `html2canvas` image generation for shareable card previews.
- **`providers/`** — App-wide context providers (settings, theme, etc.).
- **`radio/`** — YouTube-backed mood playlist UI.
- **`search/`** — Project-wide search UI (backed by `src/lib/search/`).
- **`settings/`** — Settings dialogs: `AppSettingsDialog`, `AiSettings`, `BackupSettings`, `DictionaryManagerDialog`, `ImportBackupDialog`, `AppearanceSettings`, `EditorSettings`, `GeneralTabContent`, `GrammarRulesDialog`, `SavedPromptsManager`, `ShortcutsHelpDialog`. `agent-tool-picker` holds the allowed-tools picker config shared by the agent editor. (Agent editing moved to `agents/AgentEditorBody` + the `/agents/definitions` routes.)
- **`sprint/`** — Writing-sprint UI: `SprintWidget`, `SprintConfigDialog`, `SprintHistoryDialog`.
- **`stats/`** — Writing analytics: `WritingStatsDashboard`, `DailyWordChart`, `TimeOfDayChart`, `StatCard`, `StreakDisplay`.
- **`ui/`** — Reusable primitives (see below).
- **`worldbuilding/`** — Worldbuilding doc editor: `WorldbuildingDocDialog`, `CompiledView`.

## Reusable primitives (`src/components/ui/`)

Always check here before building new UI:

- **`Modal`** — Backdrop + panel + escape-to-close. Props: `children`, `onClose`, `maxWidth?`.
- **`ConfirmDialog`** — Yes/no with optional third action. Props: `title`, `message`, `onConfirm`, `onCancel`, `variant`, `extraAction?`.
- **`ContextMenu`** — Positioned right-click menu with viewport flipping. Compound: `ContextMenu`, `ContextMenuItem`, `ContextMenuSeparator`, `ContextMenuLabel`.
- **`Badge`** — Simple styled span. Props: `label`, `className?`.
- **`AutoResizeTextarea`** — Auto-growing textarea.
- **`DialogFooter`** — Standard Cancel + Submit footer with optional left slot.
- **`TriStateCheckbox`** — Three-state checkbox (`"off" | "on" | "partial"`).

### Style exports

- `button-styles.ts` → `BUTTON_PRIMARY`, `BUTTON_CANCEL`, `BUTTON_DANGER`, `RADIO_BASE/ACTIVE/INACTIVE`.
- `form-styles.ts` → `INPUT_CLASS`, `LABEL_CLASS` (also re-exports `BUTTON_PRIMARY`, `BUTTON_CANCEL`, `RADIO_BASE/ACTIVE/INACTIVE`).

## CSS / theming conventions

- Custom properties: `--primary-*`, `--neutral-*` (color scales), `--editor-content-width`, `--density-*`.
- Density is controlled by the `[data-density]` attribute on the root.
- Custom Tailwind utilities: `py-density-item`, `py-density-button`, `gap-density`.
- Theme application happens in `src/lib/theme/` (`applyPrimaryColor`, `applyNeutralColor`, `applyEditorWidth`, `applyUiDensity`).
