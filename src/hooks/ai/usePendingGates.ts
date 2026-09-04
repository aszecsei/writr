"use client";

import { useCallback, useRef, useState } from "react";
import type { PendingGate } from "@/components/ai/PendingGatesBar";

/**
 * `Omit` doesn't distribute over a union — it would collapse `PendingGate`
 * down to its shared fields and drop `toolDisplayName` / `question` /
 * `options`. This distributes it per-variant instead.
 */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

/**
 * Gates bubbled up from sub-agent runs — mutation approvals and
 * `present_choice` prompts — surfaced in `PendingGatesBar` regardless of
 * which transcript view the user is in. `pushGate` resolves once the user
 * acts on it (or `resetGates` resolves everything with a sensible default,
 * e.g. on cancel).
 */
export function usePendingGates() {
  const [pendingGates, setPendingGates] = useState<PendingGate[]>([]);

  // Resolvers for bubbled-up sub-agent gates, keyed by gate id. The "kind"
  // lets resetGates resolve each with a sensible default (deny / empty).
  const gateResolversRef = useRef<
    Map<
      string,
      {
        kind: "approval" | "choice";
        resolve: (value: boolean | string) => void;
      }
    >
  >(new Map());

  const pushGate = useCallback(
    <T extends boolean | string>(
      gate: DistributiveOmit<PendingGate, "id">,
    ): Promise<T> => {
      const gateId = crypto.randomUUID();
      return new Promise<T>((resolve) => {
        gateResolversRef.current.set(gateId, {
          kind: gate.kind,
          resolve: resolve as (value: boolean | string) => void,
        });
        setPendingGates((prev) => [
          ...prev,
          { ...gate, id: gateId } as PendingGate,
        ]);
      });
    },
    [],
  );

  const resolveGate = useCallback((gateId: string, value: boolean | string) => {
    const entry = gateResolversRef.current.get(gateId);
    if (entry) {
      gateResolversRef.current.delete(gateId);
      entry.resolve(value);
    }
    setPendingGates((prev) => prev.filter((g) => g.id !== gateId));
  }, []);

  // Resolve any bubbled sub-agent gates so nested runs unwind: deny pending
  // approvals, return an empty choice (the abort signal stops the run next).
  const resetGates = useCallback(() => {
    for (const { kind, resolve } of gateResolversRef.current.values()) {
      resolve(kind === "approval" ? false : "");
    }
    gateResolversRef.current.clear();
    setPendingGates([]);
  }, []);

  return { pendingGates, pushGate, resolveGate, resetGates };
}
