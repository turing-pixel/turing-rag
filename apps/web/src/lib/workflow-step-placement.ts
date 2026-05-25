import type { Edge } from "@xyflow/react";

import {
  WORKFLOW_NODE_LAYOUT_X_GAP,
  WORKFLOW_NODE_LAYOUT_Y_GAP,
} from "@/lib/workflow-graph-utils";

export type WorkflowStepSide = "top" | "right" | "bottom" | "left";

export const WORKFLOW_STEP_SIDES: WorkflowStepSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

export function positionForNewStep(
  anchor: { x: number; y: number },
  side: WorkflowStepSide
): { x: number; y: number } {
  switch (side) {
    case "right":
      return { x: anchor.x + WORKFLOW_NODE_LAYOUT_X_GAP, y: anchor.y };
    case "left":
      return { x: anchor.x - WORKFLOW_NODE_LAYOUT_X_GAP, y: anchor.y };
    case "bottom":
      return { x: anchor.x, y: anchor.y + WORKFLOW_NODE_LAYOUT_Y_GAP };
    case "top":
      return { x: anchor.x, y: anchor.y - WORKFLOW_NODE_LAYOUT_Y_GAP };
  }
}

export function connectionForNewStep(
  fromId: string,
  newId: string,
  side: WorkflowStepSide
): Pick<Edge, "source" | "target" | "sourceHandle" | "targetHandle"> {
  switch (side) {
    case "right":
      return {
        source: fromId,
        sourceHandle: "right",
        target: newId,
        targetHandle: "left",
      };
    case "left":
      return {
        source: newId,
        sourceHandle: "right",
        target: fromId,
        targetHandle: "left",
      };
    case "bottom":
      return {
        source: fromId,
        sourceHandle: "bottom",
        target: newId,
        targetHandle: "top",
      };
    case "top":
      return {
        source: newId,
        sourceHandle: "bottom",
        target: fromId,
        targetHandle: "top",
      };
  }
}
