import { Handle, type NodeProps, Position } from "@xyflow/react";

const roleBorderColor: Record<string, string> = {
  protagonist: "border-l-amber-500",
  antagonist: "border-l-red-500",
  supporting: "border-l-blue-500",
  minor: "border-l-zinc-400",
};

export type CharacterNodeData = {
  label: string;
  role: string;
};

export function CharacterNode({
  data,
}: NodeProps & { data: CharacterNodeData }) {
  const borderClass = roleBorderColor[data.role] ?? "border-l-zinc-400";

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div
        className={`rounded-md border border-zinc-200 border-l-4 ${borderClass} bg-white px-3 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900`}
      >
        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[150px]">
          {data.label}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
          {data.role}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </>
  );
}
