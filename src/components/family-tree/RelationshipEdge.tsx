import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from "@xyflow/react";
import { relationshipTypeConfigs } from "./relationship-config";

export type RelationshipEdgeData = {
  relationshipType: string;
  customLabel: string;
};

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps & { data: RelationshipEdgeData }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const config =
    relationshipTypeConfigs[
      data.relationshipType as keyof typeof relationshipTypeConfigs
    ] ?? relationshipTypeConfigs.custom;
  const label =
    data.relationshipType === "custom" && data.customLabel
      ? data.customLabel
      : (config.label ?? data.relationshipType);

  const isDirectional =
    data.relationshipType === "parent" || data.relationshipType === "child";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: config.edgeStroke,
          strokeWidth: 2,
          strokeDasharray: config.edgeDasharray,
        }}
        markerEnd={isDirectional ? "url(#arrow)" : undefined}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-900/90 dark:text-neutral-400"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
