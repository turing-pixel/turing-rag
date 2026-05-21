"use client";

import type { Node, NodeProps } from "@xyflow/react";

export type RagLaneNodeData = {
  label: string;
};

export type RagLaneNode = Node<RagLaneNodeData, "lane">;

export function RagLaneNode({ data }: NodeProps<RagLaneNode>) {
  return (
    <div className="pointer-events-none flex size-full flex-col rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {data.label}
      </span>
    </div>
  );
}
