import { AgentEditor } from "@/components/settings/AgentEditor";
import { AgentsManager } from "@/components/settings/AgentsManager";
import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { DictionaryManagerDialog } from "@/components/settings/DictionaryManagerDialog";

/**
 * The Settings modal and every modal reachable from within it. Mount this
 * wherever Settings is openable so chained openModal() calls (Manage Agents,
 * Manage Dictionaries) have a renderer — otherwise they silently no-op.
 */
export function SettingsModals() {
  return (
    <>
      <AppSettingsDialog />
      <AgentsManager />
      <AgentEditor />
      <DictionaryManagerDialog />
    </>
  );
}
