"use client";
"use no memo";

import {
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
  type EdgeTypes,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddRelationshipDialog } from "@/components/family-tree/AddRelationshipDialog";
import {
  CharacterNode,
  type CharacterNodeData,
} from "@/components/family-tree/CharacterNode";
import { RelationshipEdge } from "@/components/family-tree/RelationshipEdge";
import { RelationshipList } from "@/components/family-tree/RelationshipList";
import {
  useCharactersByProject,
  useRelationshipsByProject,
} from "@/hooks/data/useBibleEntries";
import { layoutNodes } from "@/hooks/ui/useAutoLayout";

const nodeTypes: NodeTypes = { character: CharacterNode };
const edgeTypes: EdgeTypes = { relationship: RelationshipEdge };

function FamilyTreeCanvas() {
  const params = useParams<{ projectId: string }>();
  const characters = useCharactersByProject(params.projectId);
  const relationships = useRelationshipsByProject(params.projectId);
  const [showDialog, setShowDialog] = useState(false);

  // --- Controlled ReactFlow state ---
  const [nodes, setNodes] = useState<Node[]>([]);
  const prevFingerprint = useRef("");

  const edges: Edge[] = useMemo(() => {
    if (!relationships) return [];
    return relationships.map((r) => ({
      id: r.id,
      source: r.sourceCharacterId,
      target: r.targetCharacterId,
      type: "relationship" as const,
      data: { relationshipType: r.type, customLabel: r.customLabel },
    }));
  }, [relationships]);

  // Sync Dexie data → ReactFlow nodes, applying layout on structural changes
  useEffect(() => {
    if (!characters) return;

    const rawNodes: Node[] = characters.map((c) => ({
      id: c.id,
      type: "character" as const,
      position: { x: 0, y: 0 },
      data: { label: c.name, role: c.role },
    }));

    const fingerprint = [
      ...rawNodes.map((n) => n.id).sort(),
      ...edges.map((e) => `${e.source}-${e.target}`).sort(),
    ].join("|");

    if (fingerprint !== prevFingerprint.current) {
      // Structure changed — run full layout
      prevFingerprint.current = fingerprint;
      setNodes(layoutNodes(rawNodes, edges));
    } else {
      // Only data changed (name, role) — update in place, keep positions
      setNodes((current) =>
        current.map((existing) => {
          const updated = rawNodes.find((n) => n.id === existing.id);
          return updated ? { ...existing, data: updated.data } : existing;
        }),
      );
    }
  }, [characters, edges]);

  // Handle drag, select, remove etc.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  // Empty state: no characters
  if (characters && characters.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No characters yet. Add characters to start building your family tree.
        </p>
        <Link
          href={`/projects/${params.projectId}/bible/characters`}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
        >
          Go to Characters
        </Link>
      </div>
    );
  }

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        className="bg-neutral-50 dark:bg-neutral-950"
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const role = (node.data as CharacterNodeData)?.role;
            if (role === "protagonist") return "#f59e0b";
            if (role === "antagonist") return "#ef4444";
            if (role === "supporting") return "#3b82f6";
            return "#a1a1aa";
          }}
        />
        {relationships && characters && (
          <RelationshipList
            relationships={relationships}
            characters={characters}
          />
        )}
        {/* Arrow marker for directional edges */}
        <svg aria-hidden="true">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>

      <div className="absolute left-4 top-4 z-10">
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-primary-700 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-400"
        >
          Add Relationship
        </button>
      </div>

      {showDialog && characters && (
        <AddRelationshipDialog
          projectId={params.projectId}
          characters={characters}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}

export default function FamilyTreePage() {
  return (
    <div className="relative h-full w-full">
      <ReactFlowProvider>
        <FamilyTreeCanvas />
      </ReactFlowProvider>
    </div>
  );
}
