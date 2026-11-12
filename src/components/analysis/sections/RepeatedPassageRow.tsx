"use client";

import Link from "next/link";
import { useState } from "react";
import { SideBySideDiff } from "@/components/ui/SideBySideDiff";
import type { ChapterId, ProjectId } from "@/db/schemas";
import type {
  RepeatCluster,
  RepeatMember,
} from "@/lib/text-analysis/repeats/types";
import { useEditorStore } from "@/store/editorStore";

const VISIBLE_MEMBERS = 3;
/** Keep the diff readable (and cheap) for a duplicated chapter. */
const DIFF_MAX_CHARS = 2000;

function clip(text: string): string {
  return text.length > DIFF_MAX_CHARS
    ? `${text.slice(0, DIFF_MAX_CHARS)}…`
    : text;
}

interface RowProps {
  cluster: RepeatCluster;
  /** Score of the top cluster, scaling every row's meter. */
  topScore: number;
  projectId: ProjectId;
  titleOf: (id: ChapterId) => string;
}

export function RepeatedPassageRow({
  cluster,
  topScore,
  projectId,
  titleOf,
}: RowProps) {
  const [showAll, setShowAll] = useState(false);
  const [comparing, setComparing] = useState<number | null>(null);
  const { members } = cluster;
  const visible = showAll ? members : members.slice(0, VISIBLE_MEMBERS);
  const fill = topScore > 0 ? cluster.score / topScore : 0;

  const compared = comparing === null ? null : members[comparing];
  const comparedWith =
    compared?.bestEarlier != null ? members[compared.bestEarlier] : null;

  return (
    <li>
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-neutral-100 px-1 text-[10px] font-medium tabular-nums text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {members.length}×
        </span>
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          ~{cluster.redundantWords.toLocaleString()} redundant{" "}
          {cluster.redundantWords === 1 ? "word" : "words"}
        </span>
        <span className="flex-1" />
        <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-amber-400 dark:bg-amber-500"
            style={{ width: `${fill * 100}%` }}
          />
        </div>
      </div>
      <ul className="mt-1 space-y-1">
        {visible.map((member, index) => (
          <MemberLine
            key={`${member.chapterId}:${member.anchor.occurrence}:${member.anchor.tokens.length}:${member.excerpt}`}
            member={member}
            projectId={projectId}
            title={titleOf(member.chapterId)}
            isComparing={comparing === index}
            onCompare={
              member.bestEarlier === null
                ? undefined
                : () => setComparing(comparing === index ? null : index)
            }
          />
        ))}
      </ul>
      {members.length > VISIBLE_MEMBERS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 text-[11px] text-primary-600 hover:underline dark:text-primary-400"
        >
          {showAll ? "Show fewer" : `+${members.length - VISIBLE_MEMBERS} more`}
        </button>
      )}
      {compared && comparedWith && (
        <div className="mt-2">
          <SideBySideDiff
            before={clip(comparedWith.text)}
            after={clip(compared.text)}
            beforeLabel={titleOf(comparedWith.chapterId)}
            afterLabel={titleOf(compared.chapterId)}
          />
        </div>
      )}
    </li>
  );
}

function MemberLine({
  member,
  projectId,
  title,
  isComparing,
  onCompare,
}: {
  member: RepeatMember;
  projectId: ProjectId;
  title: string;
  isComparing: boolean;
  onCompare: (() => void) | undefined;
}) {
  const requestPassageReveal = useEditorStore((s) => s.requestPassageReveal);
  return (
    <li className="flex items-start gap-1.5 text-[11px] leading-snug">
      <Link
        href={`/projects/${projectId}/chapters/${member.chapterId}`}
        onClick={() =>
          requestPassageReveal({
            chapterId: member.chapterId,
            anchor: member.anchor,
          })
        }
        className="min-w-0 flex-1 rounded px-1 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-900"
      >
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {title}
        </span>
        <span className="text-neutral-400 dark:text-neutral-500"> · </span>
        <span className="text-neutral-500 dark:text-neutral-400">
          {member.excerpt}
        </span>
      </Link>
      {onCompare && (
        <button
          type="button"
          onClick={onCompare}
          aria-pressed={isComparing}
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            isComparing
              ? "bg-primary-600 text-white dark:bg-primary-500"
              : "text-primary-600 hover:bg-neutral-100 dark:text-primary-400 dark:hover:bg-neutral-900"
          }`}
        >
          Compare
        </button>
      )}
    </li>
  );
}
