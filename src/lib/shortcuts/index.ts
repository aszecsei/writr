// Populates `shortcutRegistry` as a side effect of import.
import "./commands";

export {
  bufferMatches,
  ChordTracker,
  formatBinding,
  isMac,
  isPlainKey,
  matchCombo,
  type ParsedCombo,
  parseBinding,
} from "./keys";
export { shortcutRegistry } from "./registry";
export {
  type Command,
  type CommandCategory,
  type CommandContext,
  commandTitle,
} from "./types";
