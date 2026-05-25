"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Background,
  ConnectionLineType,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/components/workflow/workflow-flow.css";

import { WORKFLOW_EDGE_DEFAULTS, WorkflowEdge } from "@/components/workflow/workflow-edge";
import {
  WorkflowRunDock,
  type WorkflowRunDockMode,
} from "@/components/workflow/workflow-run-dock";
import { WorkflowStepNode } from "@/components/workflow/workflow-step-node";
import {
  WorkflowStudioToolbar,
  type WorkflowStudioToolbarProps,
} from "@/components/workflow/workflow-studio-toolbar";
import { WorkflowStudioProvider } from "@/components/workflow/workflow-studio-context";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STEP_TYPES,
  createDefaultStep,
  flowToWorkflowGraph,
  graphToFlowNodes,
  resolvedStepsFromGraph,
  type WorkflowStepNodeData,
} from "@/lib/workflow-graph-utils";
import {
  connectionForNewStep,
  positionForNewStep,
  type WorkflowStepSide,
} from "@/lib/workflow-step-placement";
import type { WorkflowGraph, WorkflowStep } from "@/lib/workflow";
import type { StepProgressState } from "@/components/workflow/workflow-run-progress";
import { cn } from "@/lib/utils";

const nodeTypes = { workflowStep: WorkflowStepNode };
const edgeTypes = { workflow: WorkflowEdge };

export interface WorkflowStudioProps {
  graph: WorkflowGraph | null | undefined;
  steps: WorkflowStep[];
  onChange: (payload: { graph: WorkflowGraph; steps: WorkflowStep[] }) => void;
  workflowUuid: string;
  templateKey?: string;
  inputSchema?: Record<string, unknown>;
  runInput: Record<string, unknown>;
  onRunInputChange: (value: Record<string, unknown>) => void;
  onBeforeTest?: () => Promise<void>;
  fullWidth?: boolean;
  toolbar: Omit<
    WorkflowStudioToolbarProps,
    "onAddStep" | "runDockMode" | "onToggleRunDock"
  > & {
    stepProgress?: Record<string, StepProgressState>;
  };
}

function WorkflowStudioInner({
  graph,
  steps,
  onChange,
  workflowUuid,
  templateKey,
  inputSchema,
  runInput,
  onRunInputChange,
  onBeforeTest,
  fullWidth = false,
  toolbar,
}: WorkflowStudioProps) {
  const t = useTranslations("dashboard.workflows");
  const syncingFromProps = useRef(false);

  const [runStatusByKey, setRunStatusByKey] = useState<
    Record<string, WorkflowStepNodeData["runStatus"]>
  >({});
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addContext, setAddContext] = useState<{
    fromNodeId: string | null;
    side: WorkflowStepSide | null;
  }>({ fromNodeId: null, side: null });
  const [runDockMode, setRunDockMode] = useState<WorkflowRunDockMode | null>(null);
  const [newStepType, setNewStepType] = useState<WorkflowStep["type"]>("llm");
  const [newStepKey, setNewStepKey] = useState("");

  const openAddStepDialog = useCallback(
    (fromNodeId: string | null = null, side: WorkflowStepSide | null = null) => {
      setAddContext({ fromNodeId, side });
      setAddOpen(true);
    },
    []
  );

  const closeAddStepDialog = useCallback((open: boolean) => {
    setAddOpen(open);
    if (!open) {
      setAddContext({ fromNodeId: null, side: null });
      setNewStepKey("");
    }
  }, []);

  const initialFlow = useMemo(
    () => graphToFlowNodes(graph, steps, runStatusByKey),
    [graph, steps, runStatusByKey]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);

  const graphSnapshot = useMemo(() => JSON.stringify(graph ?? null), [graph]);
  const stepsSnapshot = useMemo(
    () => steps.map((s) => `${s.key}:${s.type}`).join("|"),
    [steps]
  );

  useEffect(() => {
    syncingFromProps.current = true;
    const next = graphToFlowNodes(graph, steps, runStatusByKey);
    setNodes(next.nodes);
    setEdges(next.edges);
    syncingFromProps.current = false;
  }, [graphSnapshot, stepsSnapshot, graph, steps, runStatusByKey, setNodes, setEdges]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, runStatus: runStatusByKey[n.id] },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        type: "workflow",
        animated: runStatusByKey[e.source] === "running",
      }))
    );
  }, [runStatusByKey, setNodes, setEdges]);

  const publish = useCallback(
    (nextNodes: Node<WorkflowStepNodeData>[], nextEdges: Edge[]) => {
      if (syncingFromProps.current) return;
      const nextGraph = flowToWorkflowGraph(nextNodes, nextEdges);
      const nextSteps = resolvedStepsFromGraph(nextGraph);
      onChange({ graph: nextGraph, steps: nextSteps });
    },
    [onChange]
  );

  const updateStep = useCallback(
    (nodeId: string, step: WorkflowStep) => {
      const idChanged = Boolean(step.key && step.key !== nodeId);
      if (idChanged) {
        setExpandedNodeId((current) => (current === nodeId ? step.key : current));
      }
      setNodes((nds) => {
        const updated = nds.map((n) => {
          if (n.id !== nodeId) return n;
          const newId = step.key || nodeId;
          return {
            ...n,
            id: newId,
            data: { ...n.data, step: { ...step, key: newId } },
          };
        });
        let nextEdges = edges;
        if (idChanged) {
          nextEdges = edges.map((e) => ({
            ...e,
            source: e.source === nodeId ? step.key : e.source,
            target: e.target === nodeId ? step.key : e.target,
          }));
          setEdges(nextEdges);
        }
        publish(updated, nextEdges);
        return updated;
      });
    },
    [edges, publish, setNodes, setEdges]
  );

  const deleteStep = useCallback(
    (nodeId: string) => {
      setExpandedNodeId((current) => (current === nodeId ? null : current));
      setNodes((nds) => {
        const updated = nds.filter((n) => n.id !== nodeId);
        setEdges((eds) => {
          const nextEdges = eds.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          );
          publish(updated, nextEdges);
          return nextEdges;
        });
        return updated;
      });
    },
    [publish, setNodes, setEdges]
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedNodeId((current) => (current === id ? null : id));
  }, []);

  const onRequestAddStep = useCallback(
    (fromNodeId: string, side: WorkflowStepSide) => {
      openAddStepDialog(fromNodeId, side);
    },
    [openAddStepDialog]
  );

  const studioContextValue = useMemo(
    () => ({
      onStepChange: updateStep,
      onStepDelete: deleteStep,
      onRequestAddStep,
      expandedNodeId,
      setExpandedNodeId,
      toggleExpanded,
    }),
    [updateStep, deleteStep, onRequestAddStep, expandedNodeId, toggleExpanded]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<WorkflowStepNodeData>>[]) => {
      onNodesChange(changes);
      const structural = changes.some(
        (c) => c.type === "position" && c.dragging === false
      );
      if (structural) {
        queueMicrotask(() => {
          setNodes((current) => {
            publish(current, edges);
            return current;
          });
        });
      }
    },
    [onNodesChange, edges, publish, setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      const structural = changes.some(
        (c) => c.type === "add" || c.type === "remove" || c.type === "replace"
      );
      if (structural) {
        queueMicrotask(() => {
          setEdges((current) => {
            setNodes((nds) => {
              publish(nds, current);
              return nds;
            });
            return current;
          });
        });
      }
    },
    [onEdgesChange, publish, setNodes, setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const updated = addEdge(connection, eds);
        setNodes((nds) => {
          publish(nds, updated);
          return nds;
        });
        return updated;
      });
    },
    [publish, setEdges, setNodes]
  );

  const handleAddStep = () => {
    const key = newStepKey.trim() || `${newStepType}_${nodes.length + 1}`;
    if (nodes.some((n) => n.id === key)) {
      return;
    }
    const step = createDefaultStep(newStepType, key);
    const anchor =
      addContext.fromNodeId != null
        ? nodes.find((n) => n.id === addContext.fromNodeId)
        : undefined;
    const position =
      anchor && addContext.side
        ? positionForNewStep(anchor.position, addContext.side)
        : {
            x: 80 + (nodes.length % 3) * 120,
            y: 60 + Math.floor(nodes.length / 3) * 80,
          };

    const newNode: Node<WorkflowStepNodeData> = {
      id: key,
      type: "workflowStep",
      position,
      data: { step },
    };

    const newEdge: Edge | null =
      anchor && addContext.side
        ? {
            id: `e-${anchor.id}-${key}-${addContext.side}`,
            type: "workflow",
            ...connectionForNewStep(anchor.id, key, addContext.side),
          }
        : null;

    setEdges((eds) => {
      const nextEdges = newEdge ? [...eds, newEdge] : eds;
      setNodes((nds) => {
        const updated = [...nds, newNode];
        publish(updated, nextEdges);
        return updated;
      });
      return nextEdges;
    });
    closeAddStepDialog(false);
    setExpandedNodeId(key);
  };

  const onRunStatusChange = useCallback(
    (status: Record<string, StepProgressState["status"]>) => {
      setRunStatusByKey(status as Record<string, WorkflowStepNodeData["runStatus"]>);
    },
    []
  );

  const toggleRunDock = useCallback((mode: WorkflowRunDockMode) => {
    setRunDockMode((current) => (current === mode ? null : mode));
  }, []);

  return (
    <WorkflowStudioProvider value={studioContextValue}>
      <WorkflowStudioLayout
        fullWidth={fullWidth}
        toolbar={
          <WorkflowStudioToolbar
            {...toolbar}
            workflowUuid={workflowUuid}
            templateKey={templateKey || toolbar.templateKey}
            steps={steps}
            inputSchema={inputSchema}
            runInput={runInput}
            onRunInputChange={onRunInputChange}
            onBeforeTest={onBeforeTest}
            onAddStep={() => openAddStepDialog()}
            onRunStatusChange={onRunStatusChange}
            onTestRunComplete={() => setRunStatusByKey({})}
            runDockMode={runDockMode}
            onToggleRunDock={toggleRunDock}
          />
        }
        runDock={
          runDockMode ? (
            <WorkflowRunDock
              mode={runDockMode}
              onModeChange={setRunDockMode}
              onClose={() => setRunDockMode(null)}
              workflowUuid={workflowUuid}
              templateKey={templateKey}
              steps={steps}
              inputSchema={inputSchema}
              runInput={runInput}
              onRunInputChange={onRunInputChange}
              onBeforeTest={onBeforeTest}
              onRunStatusChange={onRunStatusChange}
              onTestRunComplete={() => setRunStatusByKey({})}
              productionRunning={toolbar.running}
              productionProgress={toolbar.stepProgress}
              onProductionRun={toolbar.onProductionRun}
            />
          ) : null
        }
        canvas={
          <WorkflowStudioCanvas
            nodes={nodes}
            edges={edges}
            onPaneClick={() => setExpandedNodeId(null)}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
          />
        }
      />

      <Dialog open={addOpen} onOpenChange={closeAddStepDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("studio.addStep")}</DialogTitle>
            {addContext.fromNodeId && addContext.side ? (
              <DialogDescription>
                {t(`studio.addStepFrom.${addContext.side}`, {
                  step: addContext.fromNodeId,
                })}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("studio.stepType")}</Label>
              <Select
                value={newStepType}
                onValueChange={(v) => setNewStepType(v as WorkflowStep["type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEP_TYPES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("studio.stepKey")}</Label>
              <Input
                value={newStepKey}
                onChange={(e) => setNewStepKey(e.target.value)}
                placeholder={`${newStepType}_1`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddStep}>{t("studio.addStep")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkflowStudioProvider>
  );
}

function WorkflowStudioLayout({
  fullWidth,
  toolbar,
  canvas,
  runDock,
}: {
  fullWidth: boolean;
  toolbar: React.ReactNode;
  canvas: React.ReactNode;
  runDock?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        fullWidth ? "h-full" : "h-[min(720px,calc(100vh-220px))] min-h-[520px]"
      )}
    >
      {toolbar}
      {fullWidth ? <Separator /> : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        {runDock ? (
          <ResizablePanelGroup
            id="workflow-studio-split"
            orientation="horizontal"
            className="h-full w-full min-h-0"
            defaultLayout={{ canvas: 72, dock: 28 }}
          >
            <ResizablePanel
              id="canvas"
              defaultSize="72%"
              minSize="45%"
              className="min-h-0 min-w-0"
            >
              <div
                className={cn(
                  "relative h-full w-full min-h-0 min-w-0 overflow-hidden",
                  !fullWidth && "rounded-lg border"
                )}
              >
                {canvas}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              id="dock"
              defaultSize="28%"
              minSize="240px"
              maxSize="45%"
              className="min-h-0 min-w-0"
            >
              <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
                {runDock}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div
            className={cn(
              "relative h-full min-h-0 min-w-0 overflow-hidden",
              !fullWidth && "rounded-lg border"
            )}
          >
            {canvas}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowStudioCanvas({
  nodes,
  edges,
  onPaneClick,
  onNodesChange,
  onEdgesChange,
  onConnect,
}: {
  nodes: Node<WorkflowStepNodeData>[];
  edges: Edge[];
  onPaneClick: () => void;
  onNodesChange: (changes: NodeChange<Node<WorkflowStepNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
}) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable
      nodesConnectable
      elementsSelectable
      panOnScroll
      selectionOnDrag={false}
      connectionLineType={ConnectionLineType.Bezier}
      defaultEdgeOptions={WORKFLOW_EDGE_DEFAULTS}
      onPaneClick={onPaneClick}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
      minZoom={0.25}
      maxZoom={1.5}
      className="workflow-studio-flow h-full bg-muted/30"
    >
      <Background gap={24} size={1} />
      <Controls showInteractive={false} />
      <MiniMap zoomable pannable />
    </ReactFlow>
  );
}

export function WorkflowStudio(props: WorkflowStudioProps) {
  return (
    <ReactFlowProvider>
      <WorkflowStudioInner {...props} />
    </ReactFlowProvider>
  );
}
