import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { DictionaryManagerDialog } from "@/components/settings/DictionaryManagerDialog";
import { GrammarRulesDialog } from "@/components/settings/GrammarRulesDialog";
import { ImportBackupDialog } from "@/components/settings/ImportBackupDialog";

/**
 * The Settings modal and every modal reachable from within it. Mount this
 * wherever Settings is openable so chained openModal() calls (Manage
 * Dictionaries) have a renderer — otherwise they silently no-op.
 */
export function SettingsModals() {
  return (
    <>
      <AppSettingsDialog />
      <DictionaryManagerDialog />
      <GrammarRulesDialog />
      <ImportBackupDialog />
    </>
  );
}
