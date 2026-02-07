import { Badge } from "@/components/ui/Badge";
import type { ChapterStatus } from "@/db/schemas";

type Status = ChapterStatus | "unlinked";

interface StatusBadgeProps {
  status: Status;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  unlinked: {
    label: "Unlinked",
    className:
      "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400",
  },
  draft: {
    label: "Draft",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
  },
  revised: {
    label: "Revised",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400",
  },
  final: {
    label: "Final",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = statusConfig[status];
  return <Badge label={label} className={className} />;
}
