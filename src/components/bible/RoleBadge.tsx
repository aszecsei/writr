import type { CharacterRole } from "@/db/schemas";

const roleStyles: Record<CharacterRole, string> = {
  protagonist:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  antagonist: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  supporting:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  minor: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const roleLabels: Record<CharacterRole, string> = {
  protagonist: "Protagonist",
  antagonist: "Antagonist",
  supporting: "Supporting",
  minor: "Minor",
};

export function RoleBadge({ role }: { role: CharacterRole }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${roleStyles[role]}`}
    >
      {roleLabels[role]}
    </span>
  );
}
