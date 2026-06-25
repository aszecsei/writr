"use client";

import { Check, HelpCircle, ShieldAlert, X } from "lucide-react";

export type PendingGate =
  | {
      kind: "approval";
      id: string;
      agentName: string;
      toolDisplayName: string;
    }
  | {
      kind: "choice";
      id: string;
      agentName: string;
      question: string;
      options: string[];
    };

interface PendingGatesBarProps {
  gates: PendingGate[];
  onApprove: (gateId: string) => void;
  onDeny: (gateId: string) => void;
  onChoose: (gateId: string, option: string) => void;
}

/**
 * Top-of-panel surface for gates that "bubble up" from sub-agent runs: a
 * mutating tool awaiting approval, or a `present_choice` awaiting the user's
 * pick. Sub-agent activity is otherwise buried in a nested transcript, so the
 * actionable prompt is hoisted here regardless of which view the user is in.
 */
export function PendingGatesBar({
  gates,
  onApprove,
  onDeny,
  onChoose,
}: PendingGatesBarProps) {
  if (gates.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900/50 dark:bg-amber-950/40">
      {gates.map((gate) =>
        gate.kind === "approval" ? (
          <div key={gate.id} className="space-y-1.5">
            <div className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">{gate.agentName}</span> wants to
                run <span className="font-mono">{gate.toolDisplayName}</span>.
              </span>
            </div>
            <div className="flex gap-2 pl-5">
              <button
                type="button"
                onClick={() => onApprove(gate.id)}
                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              >
                <Check size={12} />
                Approve
              </button>
              <button
                type="button"
                onClick={() => onDeny(gate.id)}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <X size={12} />
                Deny
              </button>
            </div>
          </div>
        ) : (
          <div key={gate.id} className="space-y-1.5">
            <div className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <HelpCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">{gate.agentName}</span> asks:{" "}
                {gate.question}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pl-5">
              {gate.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChoose(gate.id, option)}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-neutral-900 dark:text-amber-300 dark:hover:bg-amber-900/40"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
