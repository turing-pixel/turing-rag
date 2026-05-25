import type { Edge, Node } from "@xyflow/react";

import type { WorkflowGraph, WorkflowStep } from "@/lib/workflow";

export type WorkflowStepNodeData = {
  step: WorkflowStep;
  runStatus?: "pending" | "running" | "completed" | "failed";
};

export const STEP_TYPES: WorkflowStep["type"][] = [
  "retrieve",
  "llm",
  "condition",
  "format",
];

/** Fixed node width (px); expand only grows height for a stable canvas layout. */
export const WORKFLOW_NODE_WIDTH = 400;
export const WORKFLOW_NODE_LAYOUT_X_GAP = 448;
export const WORKFLOW_NODE_LAYOUT_Y_GAP = 176;

export function buildStepDefinitions(
  steps: WorkflowStep[],
  graph?: WorkflowGraph | null
): Record<string, WorkflowStep> {
  const defs: Record<string, WorkflowStep> = {};
  if (graph?.stepDefinitions) {
    Object.assign(defs, graph.stepDefinitions);
  }
  for (const step of steps) {
    if (step.key) {
      defs[step.key] = { ...defs[step.key], ...step };
    }
  }
  return defs;
}

export function topologicalStepOrder(
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>
): string[] {
  const nodeIds = nodes.map((n) => n.id);
  const indegree: Record<string, number> = Object.fromEntries(
    nodeIds.map((id) => [id, 0])
  );
  const adj: Record<string, string[]> = {};

  for (const id of nodeIds) {
    adj[id] = [];
  }
  for (const edge of edges) {
    if (edge.source in adj && edge.target in indegree) {
      adj[edge.source].push(edge.target);
      indegree[edge.target] = (indegree[edge.target] ?? 0) + 1;
    }
  }

  const queue = nodeIds.filter((id) => indegree[id] === 0);
  const ordered: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const next of adj[id] || []) {
      indegree[next] -= 1;
      if (indegree[next] === 0) {
        queue.push(next);
      }
    }
  }
  if (ordered.length !== nodeIds.length) {
    return nodeIds;
  }
  return ordered;
}

export function resolvedStepsFromGraph(graph: WorkflowGraph): WorkflowStep[] {
  const defs = graph.stepDefinitions || {};
  const order = topologicalStepOrder(graph.nodes, graph.edges);
  return order
    .map((id) => defs[id])
    .filter((s): s is WorkflowStep => Boolean(s?.key));
}

export function graphToFlowNodes(
  graph: WorkflowGraph | null | undefined,
  steps: WorkflowStep[],
  runStatusByKey?: Record<string, WorkflowStepNodeData["runStatus"]>
): { nodes: Node<WorkflowStepNodeData>[]; edges: Edge[] } {
  const defs = buildStepDefinitions(steps, graph);

  if (graph?.nodes?.length) {
    const nodes: Node<WorkflowStepNodeData>[] = graph.nodes.map((n, i) => {
      const step = defs[n.id] || {
        key: n.id,
        type: (n.type as WorkflowStep["type"]) || "llm",
      };
      return {
        id: n.id,
        type: "workflowStep",
        position: n.position ?? {
          x: 80 + (i % 3) * WORKFLOW_NODE_LAYOUT_X_GAP,
          y: 48 + Math.floor(i / 3) * WORKFLOW_NODE_LAYOUT_Y_GAP,
        },
        data: {
          step,
          runStatus: runStatusByKey?.[n.id],
        },
      };
    });
    let edges: Edge[] = (graph.edges || []).map((e, i) => ({
      id: e.id || `e-${i}`,
      source: e.source,
      target: e.target,
      type: "workflow",
      animated: runStatusByKey?.[e.source] === "running",
    }));
    if (edges.length === 0 && nodes.length > 1) {
      const order = topologicalStepOrder(
        graph.nodes,
        []
      );
      const orderedIds =
        order.length === nodes.length
          ? order
          : nodes.map((n) => n.id);
      edges = orderedIds.slice(0, -1).map((sourceId, i) => ({
        id: `e-inferred-${i}`,
        source: sourceId,
        target: orderedIds[i + 1]!,
        type: "workflow",
        animated: runStatusByKey?.[sourceId] === "running",
      }));
    }
    return { nodes, edges };
  }

  const ordered = steps.length ? steps : Object.values(defs);
  const nodes: Node<WorkflowStepNodeData>[] = ordered.map((step, i) => ({
    id: step.key,
    type: "workflowStep",
    position: {
      x: 80 + (i % 3) * WORKFLOW_NODE_LAYOUT_X_GAP,
      y: 48 + Math.floor(i / 3) * WORKFLOW_NODE_LAYOUT_Y_GAP,
    },
    data: {
      step,
      runStatus: runStatusByKey?.[step.key],
    },
  }));
  const edges: Edge[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    edges.push({
      id: `e-${i}`,
      source: ordered[i].key,
      target: ordered[i + 1].key,
      type: "workflow",
    });
  }
  return { nodes, edges };
}

export function flowToWorkflowGraph(
  nodes: Node<WorkflowStepNodeData>[],
  edges: Edge[]
): WorkflowGraph {
  const stepDefinitions: Record<string, WorkflowStep> = {};
  for (const node of nodes) {
    const step = node.data?.step;
    if (step?.key) {
      stepDefinitions[node.id] = { ...step, key: node.id };
    }
  }
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.step.type,
      position: n.position,
      data: { label: `${n.data.step.type}: ${n.data.step.key}` },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
    stepDefinitions,
  };
}

export function createDefaultStep(
  type: WorkflowStep["type"],
  key: string
): WorkflowStep {
  const base = { key, type };
  switch (type) {
    case "retrieve":
      return {
        ...base,
        query_template: "{{input.customer_question}}",
      };
    case "llm":
      return {
        ...base,
        prompt: "在此编写 prompt，可使用 {{input.xxx}} 与 {{steps.prev_key.text}}",
      };
    case "condition":
      return {
        ...base,
        when: "low_confidence",
        retrieve_step_key: "retrieve_policy",
        message: "条件未满足，流程终止。",
      };
    case "format":
      return {
        ...base,
        format: "markdown",
      };
    default:
      return base;
  }
}
