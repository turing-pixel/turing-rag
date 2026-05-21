import type { Edge, Node } from "@xyflow/react";

import type { RagEdgeData, RagEdgeVariant } from "@/components/rag/rag-animated-edge";

export const RAG_NODE_WIDTH = 210;
export const RAG_NODE_HEIGHT = 112;

/** Default layout spacing (extra loose) */
const V_GAP = 220;
const H_GAP = 380;
const COL_LEFT = 72;
const ROW_TOP = 72;
const ROW_TURN = ROW_TOP + V_GAP * 2;
const TEST_BRANCH_OFFSET = 260;
const CHAT_SECTION_GAP = 200;
const ROW_CHAT_TURN = ROW_TOP + V_GAP * 3 + CHAT_SECTION_GAP;

export type StepKey =
  | "upload"
  | "preview"
  | "process"
  | "loadSplit"
  | "embeddings"
  | "vectorStore"
  | "persist"
  | "pollTasks"
  | "userMessage"
  | "resolveLlm"
  | "retriever"
  | "ragChain"
  | "stream"
  | "testRetrieval";

export const INGESTION_STEP_IDS: StepKey[] = [
  "upload",
  "preview",
  "process",
  "pollTasks",
  "loadSplit",
  "embeddings",
  "vectorStore",
  "persist",
];

export const CHAT_STEP_IDS: StepKey[] = [
  "userMessage",
  "resolveLlm",
  "retriever",
  "ragChain",
  "stream",
];

export const RETRIEVAL_STEP_IDS: StepKey[] = ["testRetrieval"];

const STEP_LAYOUT: Record<
  StepKey,
  { x: number; y: number; kind: "api" | "service" | "storage" | "optional" }
> = {
  upload: { x: COL_LEFT, y: ROW_TOP, kind: "api" },
  preview: { x: COL_LEFT, y: ROW_TOP + V_GAP, kind: "optional" },
  process: { x: COL_LEFT, y: ROW_TOP + V_GAP * 2, kind: "api" },
  pollTasks: { x: COL_LEFT, y: ROW_TOP + V_GAP * 3, kind: "api" },
  loadSplit: { x: COL_LEFT + H_GAP, y: ROW_TURN, kind: "service" },
  embeddings: { x: COL_LEFT + H_GAP * 2, y: ROW_TURN, kind: "service" },
  vectorStore: { x: COL_LEFT + H_GAP * 3, y: ROW_TURN, kind: "service" },
  persist: { x: COL_LEFT + H_GAP * 4, y: ROW_TURN, kind: "storage" },
  testRetrieval: {
    x: COL_LEFT + H_GAP * 3,
    y: ROW_TURN + TEST_BRANCH_OFFSET,
    kind: "api",
  },
  userMessage: { x: COL_LEFT, y: ROW_CHAT_TURN, kind: "api" },
  resolveLlm: { x: COL_LEFT, y: ROW_CHAT_TURN + V_GAP, kind: "service" },
  retriever: { x: COL_LEFT, y: ROW_CHAT_TURN + V_GAP * 2, kind: "service" },
  ragChain: {
    x: COL_LEFT + H_GAP,
    y: ROW_CHAT_TURN + V_GAP * 2,
    kind: "service",
  },
  stream: {
    x: COL_LEFT + H_GAP * 2,
    y: ROW_CHAT_TURN + V_GAP * 2,
    kind: "api",
  },
};

type Translate = (key: string) => string;

function buildLaneNodes(t: Translate): Node[] {
  return [
    {
      id: "lane-ingestion",
      type: "lane",
      position: { x: 0, y: 8 },
      data: { label: t("lanes.ingestion") },
      style: { width: 1920, height: 860, zIndex: -1 },
      selectable: false,
      draggable: false,
    },
    {
      id: "lane-chat",
      type: "lane",
      position: { x: 0, y: 820 },
      data: { label: t("lanes.chat") },
      style: { width: 1100, height: 620, zIndex: -1 },
      selectable: false,
      draggable: false,
    },
    {
      id: "lane-retrieval",
      type: "lane",
      position: { x: 1100, y: 680 },
      data: { label: t("lanes.retrieval") },
      style: { width: 480, height: 380, zIndex: -1 },
      selectable: false,
      draggable: false,
    },
  ];
}

export function buildStepNodes(t: Translate): Node[] {
  return (Object.keys(STEP_LAYOUT) as StepKey[]).map((key) => {
    const layout = STEP_LAYOUT[key];
    const detail = t(`steps.${key}.detail`);
    return {
      id: key,
      type: "ragStep",
      position: { x: layout.x, y: layout.y },
      draggable: true,
      data: {
        title: t(`steps.${key}.title`),
        subtitle: t(`steps.${key}.subtitle`),
        detail: detail.length > 0 ? detail : undefined,
        kind: layout.kind,
        kindLabel: t(`legend.${layout.kind}`),
      },
    } satisfies Node;
  });
}

export function buildInitialNodes(t: Translate): Node[] {
  return [...buildLaneNodes(t), ...buildStepNodes(t)];
}

function flowEdge(
  id: string,
  source: string,
  target: string,
  options: {
    variant?: RagEdgeVariant;
    delay?: string;
    label?: string;
    sourceHandle?: string;
    targetHandle?: string;
  } = {}
): Edge {
  const {
    variant = "main",
    delay,
    label,
    sourceHandle = "out",
    targetHandle = "in",
  } = options;
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: "ragFlow",
    data: { variant, delay } satisfies RagEdgeData,
    label,
    labelStyle: label ? { fontSize: 10 } : undefined,
  };
}

export function buildRagEdges(t: Translate): Edge[] {
  return [
    flowEdge("e-upload-preview", "upload", "preview", {
      variant: "vertical",
      delay: "0s",
      sourceHandle: "out-down",
      targetHandle: "in",
    }),
    flowEdge("e-preview-process", "preview", "process", {
      variant: "vertical",
      delay: "0.2s",
      sourceHandle: "out-down",
      targetHandle: "in",
    }),
    flowEdge("e-process-poll", "process", "pollTasks", {
      variant: "vertical",
      delay: "0.35s",
      sourceHandle: "out-down",
      targetHandle: "in",
    }),
    flowEdge("e-process-load", "process", "loadSplit", {
      variant: "horizontal",
      delay: "0.5s",
      sourceHandle: "out-right",
      targetHandle: "in",
    }),
    flowEdge("e-load-embed", "loadSplit", "embeddings", { delay: "0.65s" }),
    flowEdge("e-embed-vector", "embeddings", "vectorStore", { delay: "0.8s" }),
    flowEdge("e-vector-persist", "vectorStore", "persist", { delay: "0.95s" }),
    flowEdge("e-poll-persist", "pollTasks", "persist", {
      variant: "horizontal",
      delay: "1.1s",
      sourceHandle: "out-right",
      targetHandle: "in-poll",
    }),
    flowEdge("e-user-llm", "userMessage", "resolveLlm", {
      variant: "vertical",
      delay: "0s",
      sourceHandle: "out-down",
      targetHandle: "in",
    }),
    flowEdge("e-llm-retriever", "resolveLlm", "retriever", {
      variant: "vertical",
      delay: "0.25s",
      sourceHandle: "out-down",
      targetHandle: "in",
    }),
    flowEdge("e-retriever-chain", "retriever", "ragChain", {
      variant: "horizontal",
      delay: "0.5s",
      sourceHandle: "out-right",
      targetHandle: "in",
    }),
    flowEdge("e-chain-stream", "ragChain", "stream", { delay: "0.75s" }),
    flowEdge("e-vector-retriever", "vectorStore", "retriever", {
      variant: "branch",
      delay: "0.3s",
      label: t("edges.kbCollection"),
      sourceHandle: "out-chat",
      targetHandle: "from-vector",
    }),
    flowEdge("e-embed-retriever", "embeddings", "retriever", {
      variant: "branch",
      delay: "0.6s",
      sourceHandle: "out-chat",
      targetHandle: "from-embed",
    }),
    flowEdge("e-vector-test", "vectorStore", "testRetrieval", {
      variant: "branch",
      delay: "0.9s",
      sourceHandle: "out-test",
      targetHandle: "in",
    }),
  ];
}
