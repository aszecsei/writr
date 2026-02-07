import { Badge } from "@/components/ui/Badge";
import type { CharacterRole } from "@/db/schemas";

const roleStyles: Record<CharacterRole, string> = {
  protagonist:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  antagonist: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  supporting:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  minor:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

const roleLabels: Record<CharacterRole, string> = {
  protagonist: "Protagonist",
  antagonist: "Antagonist",
  supporting: "Supporting",
  minor: "Minor",
};

export function RoleBadge({ role }: { role: CharacterRole }) {
  return <Badge label={roleLabels[role]} className={roleStyles[role]} />;
}
