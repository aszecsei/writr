import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { DictionaryManagerDialog } from "@/components/settings/DictionaryManagerDialog";
import { GrammarRulesDialog } from "@/components/settings/GrammarRulesDialog";

/**
 * The Settings modal and every modal reachable from within it. Mount this
 * wherever Settings is openable so chained openModal() calls (Manage
 * Dictionaries) have a renderer — otherwise they silently no-op.
 *
 * Agent management is no longer a modal — it lives in the Agents sidebar panel
 * and the `/projects/[projectId]/agents/definitions/...` routes.
 */
export function SettingsModals() {
  return (
    <>
      <AppSettingsDialog />
      <DictionaryManagerDialog />
      <GrammarRulesDialog />
    </>
  );
}
