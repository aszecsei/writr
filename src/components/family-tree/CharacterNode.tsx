import { Handle, type NodeProps, Position } from "@xyflow/react";

const roleBorderColor: Record<string, string> = {
  protagonist: "border-l-amber-500",
  antagonist: "border-l-red-500",
  supporting: "border-l-blue-500",
  minor: "border-l-neutral-400",
};

export type CharacterNodeData = {
  label: string;
  role: string;
};

export function CharacterNode({
  data,
}: NodeProps & { data: CharacterNodeData }) {
  const borderClass = roleBorderColor[data.role] ?? "border-l-neutral-400";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div
        className={`rounded-md border border-neutral-200 border-l-4 ${borderClass} bg-white px-3 py-2 shadow-sm dark:border-neutral-700 dark:bg-neutral-900`}
      >
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[150px]">
          {data.label}
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 capitalize">
          {data.role}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </>
  );
}
