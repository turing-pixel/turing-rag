"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { WorkflowGraph, WorkflowStep } from "@/lib/workflow";

interface WorkflowGraphEditorProps {
  graph: WorkflowGraph | null | undefined;
  steps: WorkflowStep[];
  onChange: (graph: WorkflowGraph) => void;
}

function graphToFlow(graph: WorkflowGraph | null | undefined, steps: WorkflowStep[]) {
  if (graph?.nodes?.length) {
    const nodes: Node[] = graph.nodes.map((n, i) => ({
      id: n.id,
      position: { x: 80 + (i % 3) * 220, y: 40 + Math.floor(i / 3) * 120 },
      data: { label: n.data?.label || n.id },
      type: "default",
    }));
    const edges: Edge[] = (graph.edges || []).map((e, i) => ({
      id: e.id || `e-${i}`,
      source: e.source,
      target: e.target,
    }));
    return { nodes, edges };
  }
  const nodes: Node[] = steps.map((s, i) => ({
    id: s.key,
    position: { x: 80 + (i % 3) * 220, y: 40 + Math.floor(i / 3) * 120 },
    data: { label: `${s.type}: ${s.key}` },
    type: "default",
  }));
  const edges: Edge[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    edges.push({ id: `e-${i}`, source: steps[i].key, target: steps[i + 1].key });
  }
  return { nodes, edges };
}

function flowToGraph(
  nodes: Node[],
  edges: Edge[],
  steps: WorkflowStep[]
): WorkflowGraph {
  const stepDefinitions: Record<string, WorkflowStep> = {};
  for (const step of steps) {
    stepDefinitions[step.key] = step;
  }
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.data?.label as string)?.split(":")[0] || "step",
      data: { label: n.data?.label || n.id },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
    stepDefinitions,
  };
}

function WorkflowGraphEditorInner({
  graph,
  steps,
  onChange,
}: WorkflowGraphEditorProps) {
  const initial = useMemo(() => graphToFlow(graph, steps), [graph, steps]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const { getNodes, getEdges } = useReactFlow();
  const syncingFromProps = useRef(false);

  const graphSnapshot = useMemo(() => JSON.stringify(graph ?? null), [graph]);
  const stepsSnapshot = useMemo(
    () => steps.map((s) => s.key).join(","),
    [steps]
  );

  useEffect(() => {
    syncingFromProps.current = true;
    const next = graphToFlow(graph, steps);
    setNodes(next.nodes);
    setEdges(next.edges);
    syncingFromProps.current = false;
  }, [graphSnapshot, stepsSnapshot, graph, steps, setNodes, setEdges]);

  const publishGraph = useCallback(() => {
    if (syncingFromProps.current) return;
    onChange(flowToGraph(getNodes(), getEdges(), steps));
  }, [getNodes, getEdges, onChange, steps]);

  const schedulePublish = useCallback(() => {
    queueMicrotask(publishGraph);
  }, [publishGraph]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
      schedulePublish();
    },
    [setEdges, schedulePublish]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      const structural = changes.some(
        (c) => c.type === "add" || c.type === "remove" || c.type === "replace"
      );
      if (structural) {
        schedulePublish();
      }
    },
    [onEdgesChange, schedulePublish]
  );

  return (
    <div className="h-[420px] w-full rounded-lg border border-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeDragStop={schedulePublish}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export function WorkflowGraphEditor(props: WorkflowGraphEditorProps) {
  return (
    <ReactFlowProvider>
      <WorkflowGraphEditorInner {...props} />
    </ReactFlowProvider>
  );
}
