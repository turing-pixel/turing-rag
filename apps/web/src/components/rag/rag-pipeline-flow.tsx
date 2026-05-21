"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/components/rag/rag-flow.css";

import {
  applyAutoLayout,
  type LayoutDirection,
  updateLaneBounds,
} from "@/components/rag/rag-auto-layout";
import { RagAnimatedEdge } from "@/components/rag/rag-animated-edge";
import { RagFlowToolbar } from "@/components/rag/rag-flow-toolbar";
import {
  buildInitialNodes,
  buildRagEdges,
} from "@/components/rag/rag-pipeline-data";
import { RagFlowNode } from "@/components/rag/rag-flow-node";
import { RagLaneNode } from "@/components/rag/rag-lane-node";

const nodeTypes = {
  ragStep: RagFlowNode,
  lane: RagLaneNode,
};

const edgeTypes = {
  ragFlow: RagAnimatedEdge,
};

function RagPipelineFlowCanvas() {
  const t = useTranslations("dashboard.rag");
  const { fitView } = useReactFlow();

  const initialNodes = useMemo(() => buildInitialNodes(t), [t]);
  const initialEdges = useMemo(() => buildRagEdges(t), [t]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isLayouting, setIsLayouting] = useState(false);

  useEffect(() => {
    setNodes(buildInitialNodes(t));
    setEdges(buildRagEdges(t));
  }, [t, setNodes, setEdges]);

  const runFitView = useCallback(() => {
    requestAnimationFrame(() => {
      fitView({ padding: 0.28, duration: 280 });
    });
  }, [fitView]);

  const handleAutoLayout = useCallback(
    (direction: LayoutDirection) => {
      setIsLayouting(true);
      setNodes((current) => applyAutoLayout(current, edges, direction));
      runFitView();
      window.setTimeout(() => setIsLayouting(false), 320);
    },
    [edges, setNodes, runFitView]
  );

  const handleResetLayout = useCallback(() => {
    setIsLayouting(true);
    setNodes(buildInitialNodes(t));
    runFitView();
    window.setTimeout(() => setIsLayouting(false), 320);
  }, [t, setNodes, runFitView]);

  const handleNodeDragStop = useCallback(() => {
    setNodes((current) => updateLaneBounds(current));
  }, [setNodes]);

  return (
    <div
      className="relative size-full min-h-[1000px] rounded-xl border border-border bg-background"
      aria-label={t("diagramAria")}
      role="region"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        aria-label={t("diagramAria")}
        onNodesChange={onNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: "ragFlow" }}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        minZoom={0.25}
        maxZoom={1.75}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          aria-label={t("minimapAria")}
          className="rounded-lg! border! border-border! bg-card!"
        />
        <RagFlowToolbar
          isLayouting={isLayouting}
          onAutoLayout={handleAutoLayout}
          onResetLayout={handleResetLayout}
          onFitView={runFitView}
        />
      </ReactFlow>
    </div>
  );
}

export function RagPipelineFlow() {
  return (
    <ReactFlowProvider>
      <RagPipelineFlowCanvas />
    </ReactFlowProvider>
  );
}
