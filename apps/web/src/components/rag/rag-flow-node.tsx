"use client";

import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import { STEP_ICONS, getStepIconBg } from "@/components/rag/rag-step-icons";
import type { StepKey } from "@/components/rag/rag-pipeline-data";
import { cn } from "@/lib/utils";

export type RagFlowNodeData = {
  title: string;
  subtitle?: string;
  detail?: string;
  kind: "api" | "service" | "storage" | "optional";
  kindLabel: string;
};

export type RagFlowNode = Node<RagFlowNodeData, "ragStep">;

type HandleDef = {
  id: string;
  type: "source" | "target";
  position: Position;
  style?: React.CSSProperties;
};

const HORIZONTAL_HANDLES: HandleDef[] = [
  { id: "in", type: "target", position: Position.Left },
  { id: "out", type: "source", position: Position.Right },
];

const NODE_HANDLES: Record<string, HandleDef[]> = {
  upload: [{ id: "out-down", type: "source", position: Position.Bottom }],
  preview: [
    { id: "in", type: "target", position: Position.Top },
    { id: "out-down", type: "source", position: Position.Bottom },
  ],
  process: [
    { id: "in", type: "target", position: Position.Top },
    { id: "out-right", type: "source", position: Position.Right },
    {
      id: "out-down",
      type: "source",
      position: Position.Bottom,
      style: { left: "38%" },
    },
  ],
  pollTasks: [
    { id: "in", type: "target", position: Position.Top },
    { id: "out-right", type: "source", position: Position.Right },
  ],
  persist: [
    { id: "in", type: "target", position: Position.Left },
    {
      id: "in-poll",
      type: "target",
      position: Position.Top,
      style: { left: "55%" },
    },
  ],
  embeddings: [
    { id: "in", type: "target", position: Position.Left },
    { id: "out", type: "source", position: Position.Right },
    {
      id: "out-chat",
      type: "source",
      position: Position.Bottom,
      style: { left: "50%" },
    },
  ],
  vectorStore: [
    { id: "in", type: "target", position: Position.Left },
    { id: "out", type: "source", position: Position.Right },
    {
      id: "out-chat",
      type: "source",
      position: Position.Bottom,
      style: { left: "32%" },
    },
    {
      id: "out-test",
      type: "source",
      position: Position.Bottom,
      style: { left: "68%" },
    },
  ],
  userMessage: [
    { id: "out-down", type: "source", position: Position.Bottom },
  ],
  resolveLlm: [
    { id: "in", type: "target", position: Position.Top },
    { id: "out-down", type: "source", position: Position.Bottom },
  ],
  retriever: [
    { id: "in", type: "target", position: Position.Top },
    { id: "out-right", type: "source", position: Position.Right },
    {
      id: "from-vector",
      type: "target",
      position: Position.Top,
      style: { left: "22%" },
    },
    {
      id: "from-embed",
      type: "target",
      position: Position.Top,
      style: { left: "78%" },
    },
  ],
  testRetrieval: [
    { id: "in", type: "target", position: Position.Top },
  ],
};

const kindStyles: Record<RagFlowNodeData["kind"], string> = {
  api: "border-primary/40 bg-primary/5",
  service: "border-chart-2/50 bg-chart-2/10",
  storage: "border-chart-4/50 bg-chart-4/10",
  optional: "border-dashed border-muted-foreground/40 bg-muted/30",
};

const handleClass =
  "size-2! border-2! border-background! bg-muted-foreground! opacity-0";

export function RagFlowNode({ id, data, selected }: NodeProps<RagFlowNode>) {
  const handles = NODE_HANDLES[id] ?? HORIZONTAL_HANDLES;
  const Icon = STEP_ICONS[id as StepKey];

  return (
    <div
      className={cn(
        "min-w-[180px] max-w-[210px] cursor-grab rounded-lg border px-3 py-2.5 shadow-sm transition-shadow active:cursor-grabbing",
        kindStyles[data.kind],
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
      )}
    >
      {handles.map((handle) => (
        <Handle
          key={`${handle.type}-${handle.id}`}
          id={handle.id}
          type={handle.type}
          position={handle.position}
          style={handle.style}
          className={handleClass}
        />
      ))}

      <div className="flex gap-2.5">
        {Icon ? (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              getStepIconBg(data.kind)
            )}
            aria-hidden
          >
            <Icon className="size-[18px]" strokeWidth={2} />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
              data.kind === "api" && "bg-primary/15 text-primary",
              data.kind === "service" && "bg-chart-2/20 text-chart-2",
              data.kind === "storage" && "bg-chart-4/20 text-chart-4",
              data.kind === "optional" && "bg-muted text-muted-foreground"
            )}
          >
            {data.kindLabel}
          </span>
          <p className="text-sm font-semibold leading-snug text-foreground">
            {data.title}
          </p>
          {data.subtitle ? (
            <p className="mt-1 font-mono text-[10px] leading-tight text-muted-foreground">
              {data.subtitle}
            </p>
          ) : null}
          {data.detail ? (
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              {data.detail}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
