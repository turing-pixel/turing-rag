"use client";

import { useEffect, useState } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

import { cn } from "@/lib/utils";

/** Bezier edge: dashed stroke with flowing animation, no arrowhead. */
export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
  animated,
}: EdgeProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.28,
  });

  const stroke = selected
    ? "var(--primary)"
    : animated
      ? "var(--primary)"
      : "color-mix(in oklch, var(--muted-foreground) 58%, var(--border))";

  const width = selected ? 2 : 1.5;
  const motionEnabled = !reduceMotion;

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        ...style,
        stroke,
        strokeWidth: width,
        strokeLinecap: "round",
        opacity: selected ? 1 : animated ? 0.92 : 0.78,
      }}
      className={cn(
        "workflow-edge-line",
        motionEnabled && "workflow-edge-animated",
        motionEnabled && animated && "workflow-edge-animated-fast",
        selected && "workflow-edge-selected"
      )}
    />
  );
}

export const WORKFLOW_EDGE_DEFAULTS = {
  type: "workflow" as const,
};
