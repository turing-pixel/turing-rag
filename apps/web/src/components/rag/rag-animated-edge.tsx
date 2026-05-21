"use client";

import { useEffect, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

export type RagEdgeVariant = "main" | "branch" | "vertical" | "horizontal";

export type RagEdgeData = {
  variant?: RagEdgeVariant;
  /** Stagger start for dot / dash animation, e.g. "0.4s" */
  delay?: string;
};

const FLOW_DURATION: Record<RagEdgeVariant, string> = {
  main: "2.4s",
  branch: "3.6s",
  vertical: "2.6s",
  horizontal: "2.4s",
};

export function RagAnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  labelStyle,
  data,
  selected,
}: EdgeProps) {
  const edgeData = (data ?? {}) as RagEdgeData;
  const variant = edgeData.variant ?? "main";
  const delay = edgeData.delay ?? "0s";
  const duration = FLOW_DURATION[variant];
  const isBranch = variant === "branch";
  const useSmooth =
    isBranch || variant === "vertical" || variant === "horizontal";

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const pathInput = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };

  const pathOffset =
    variant === "branch" ? 32 : variant === "vertical" ? 18 : 10;

  const [edgePath, labelX, labelY] = useSmooth
    ? getSmoothStepPath({
        ...pathInput,
        borderRadius: isBranch ? 22 : variant === "vertical" ? 18 : 14,
        offset: pathOffset,
      })
    : getBezierPath(pathInput);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: "var(--border)",
          strokeWidth: 2,
          opacity: 0.5,
        }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={selected ? 2.5 : 2}
        strokeLinecap="round"
        strokeDasharray={isBranch ? "7 11" : "10 9"}
        className={reduceMotion ? undefined : "rag-flow-edge-pulse"}
        style={{
          opacity: isBranch ? 0.7 : 0.92,
          ...(reduceMotion
            ? {}
            : {
                animationDuration: duration,
                animationDelay: delay,
              }),
        }}
      />
      {!reduceMotion ? (
        <circle r={3.5} fill="var(--primary)" className="rag-flow-edge-dot">
          <animateMotion
            dur={duration}
            begin={delay}
            repeatCount="indefinite"
            path={edgePath}
            rotate="auto"
          />
        </circle>
      ) : null}
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm ring-1 ring-border"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              ...(labelStyle as React.CSSProperties),
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
