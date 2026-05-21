import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

import {
  CHAT_STEP_IDS,
  INGESTION_STEP_IDS,
  RAG_NODE_HEIGHT,
  RAG_NODE_WIDTH,
  RETRIEVAL_STEP_IDS,
} from "@/components/rag/rag-pipeline-data";

export type LayoutDirection = "TB" | "LR";

const LANE_PADDING = 28;

function isStepNode(node: Node): boolean {
  return node.type === "ragStep";
}

function boundsForIds(nodes: Node[], ids: readonly string[]) {
  const idSet = new Set(ids);
  const matched = nodes.filter((n) => idSet.has(n.id));
  if (matched.length === 0) {
    return { minX: 0, minY: 0, maxX: 200, maxY: 120 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of matched) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + RAG_NODE_WIDTH);
    maxY = Math.max(maxY, node.position.y + RAG_NODE_HEIGHT);
  }

  return { minX, minY, maxX, maxY };
}

function layoutStepGroup(
  stepNodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
  offsetX: number,
  offsetY: number
): Node[] {
  if (stepNodes.length === 0) return [];

  const graph = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    nodesep: 88,
    ranksep: direction === "TB" ? 128 : 148,
    marginx: 32,
    marginy: 32,
  });

  const ids = new Set(stepNodes.map((n) => n.id));

  for (const node of stepNodes) {
    graph.setNode(node.id, { width: RAG_NODE_WIDTH, height: RAG_NODE_HEIGHT });
  }

  for (const edge of edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  Dagre.layout(graph);

  return stepNodes.map((node) => {
    const pos = graph.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - RAG_NODE_WIDTH / 2 + offsetX,
        y: pos.y - RAG_NODE_HEIGHT / 2 + offsetY,
      },
    };
  });
}

function wrapLane(
  lane: Node,
  box: { minX: number; minY: number; maxX: number; maxY: number }
): Node {
  const x = box.minX - LANE_PADDING;
  const y = box.minY - LANE_PADDING - 20;
  const width = box.maxX - box.minX + LANE_PADDING * 2;
  const height = box.maxY - box.minY + LANE_PADDING * 2 + 28;

  return {
    ...lane,
    position: { x, y },
    style: {
      ...lane.style,
      width,
      height,
      zIndex: -1,
    },
  };
}

export function applyAutoLayout(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "TB"
): Node[] {
  const lanes = nodes.filter((n) => n.type === "lane");
  const steps = nodes.filter(isStepNode);

  const byId = (ids: readonly string[]) =>
    steps.filter((n) => ids.includes(n.id as (typeof ids)[number]));

  const ingestion = layoutStepGroup(
    byId(INGESTION_STEP_IDS),
    edges,
    direction,
    0,
    0
  );

  const ingestionBox = boundsForIds(ingestion, INGESTION_STEP_IDS);
  const chatOffsetY =
    direction === "TB"
      ? ingestionBox.maxY + 160
      : 0;
  const chatOffsetX =
    direction === "LR"
      ? ingestionBox.maxX + 160
      : 0;

  const chat = layoutStepGroup(
    byId(CHAT_STEP_IDS),
    edges,
    direction,
    chatOffsetX,
    chatOffsetY
  );

  const positionedSteps = [...ingestion, ...chat];

  const retrievalNodes = byId(RETRIEVAL_STEP_IDS);
  const retrieval = retrievalNodes.map((node) => {
    const anchor = positionedSteps.find((n) => n.id === "vectorStore");
    if (!anchor) {
      return { ...node, position: { x: 520, y: 520 } };
    }
    return {
      ...node,
      position:
        direction === "LR"
          ? {
              x: anchor.position.x + RAG_NODE_WIDTH + 120,
              y: anchor.position.y,
            }
          : {
              x: anchor.position.x,
              y: anchor.position.y + RAG_NODE_HEIGHT + 120,
            },
    };
  });

  const allSteps = [...positionedSteps, ...retrieval];

  const laneIngestion = lanes.find((n) => n.id === "lane-ingestion");
  const laneChat = lanes.find((n) => n.id === "lane-chat");
  const laneRetrieval = lanes.find((n) => n.id === "lane-retrieval");

  const updatedLanes: Node[] = [];
  if (laneIngestion) {
    updatedLanes.push(
      wrapLane(
        laneIngestion,
        boundsForIds(allSteps, INGESTION_STEP_IDS)
      )
    );
  }
  if (laneChat) {
    updatedLanes.push(
      wrapLane(laneChat, boundsForIds(allSteps, CHAT_STEP_IDS))
    );
  }
  if (laneRetrieval) {
    updatedLanes.push(
      wrapLane(laneRetrieval, boundsForIds(allSteps, RETRIEVAL_STEP_IDS))
    );
  }

  return [...updatedLanes, ...allSteps];
}

/** Recompute lane backgrounds from current step positions (after manual drag). */
export function updateLaneBounds(nodes: Node[]): Node[] {
  const lanes = nodes.filter((n) => n.type === "lane");
  const steps = nodes.filter(isStepNode);
  if (lanes.length === 0) return nodes;

  const laneIngestion = lanes.find((n) => n.id === "lane-ingestion");
  const laneChat = lanes.find((n) => n.id === "lane-chat");
  const laneRetrieval = lanes.find((n) => n.id === "lane-retrieval");

  const updatedLanes: Node[] = [];
  if (laneIngestion) {
    updatedLanes.push(
      wrapLane(laneIngestion, boundsForIds(steps, INGESTION_STEP_IDS))
    );
  }
  if (laneChat) {
    updatedLanes.push(wrapLane(laneChat, boundsForIds(steps, CHAT_STEP_IDS)));
  }
  if (laneRetrieval) {
    updatedLanes.push(
      wrapLane(laneRetrieval, boundsForIds(steps, RETRIEVAL_STEP_IDS))
    );
  }

  return [...updatedLanes, ...steps];
}
