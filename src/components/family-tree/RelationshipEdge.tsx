import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from "@xyflow/react";

const edgeStyles: Record<
  string,
  { stroke: string; strokeDasharray?: string; label?: string }
> = {
  parent: { stroke: "#10b981" },
  child: { stroke: "#10b981" },
  spouse: { stroke: "#f43f5e" },
  divorced: { stroke: "#f43f5e", strokeDasharray: "5 3" },
  sibling: { stroke: "#0ea5e9" },
  custom: { stroke: "#8b5cf6", strokeDasharray: "5 3" },
};

const typeLabels: Record<string, string> = {
  parent: "Parent",
  child: "Child",
  spouse: "Spouse",
  divorced: "Divorced",
  sibling: "Sibling",
};

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

  const style = edgeStyles[data.relationshipType] ?? edgeStyles.custom;
  const label =
    data.relationshipType === "custom" && data.customLabel
      ? data.customLabel
      : (typeLabels[data.relationshipType] ?? data.relationshipType);

  const isDirectional =
    data.relationshipType === "parent" || data.relationshipType === "child";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: 2,
          strokeDasharray: style.strokeDasharray,
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
          className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-400"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
