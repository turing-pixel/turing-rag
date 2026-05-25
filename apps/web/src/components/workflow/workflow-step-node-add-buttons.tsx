"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { useWorkflowStudioContext } from "@/components/workflow/workflow-studio-context";
import { Button } from "@/components/ui/button";
import {
  WORKFLOW_STEP_SIDES,
  type WorkflowStepSide,
} from "@/lib/workflow-step-placement";
import { cn } from "@/lib/utils";

const SIDE_CLASS: Record<WorkflowStepSide, string> = {
  top: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
  right: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
  bottom: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
  left: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
};

const SIDE_LABEL_KEY: Record<
  WorkflowStepSide,
  "addStepTop" | "addStepRight" | "addStepBottom" | "addStepLeft"
> = {
  top: "addStepTop",
  right: "addStepRight",
  bottom: "addStepBottom",
  left: "addStepLeft",
};

interface WorkflowStepNodeAddButtonsProps {
  nodeId: string;
}

export function WorkflowStepNodeAddButtons({ nodeId }: WorkflowStepNodeAddButtonsProps) {
  const t = useTranslations("dashboard.workflows.studio");
  const { onRequestAddStep } = useWorkflowStudioContext();

  return (
    <>
      {WORKFLOW_STEP_SIDES.map((side) => (
        <Button
          key={side}
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn(
            "workflow-step-add-handle nodrag nopan nowheel absolute z-10 size-6 rounded-full border-border/80 bg-background p-0 shadow-sm",
            "opacity-0 transition-opacity group-hover/workflow-node:opacity-100",
            "hover:border-primary/50 hover:bg-background hover:text-primary",
            SIDE_CLASS[side]
          )}
          aria-label={t(SIDE_LABEL_KEY[side])}
          onClick={(e) => {
            e.stopPropagation();
            onRequestAddStep(nodeId, side);
          }}
        >
          <Plus className="size-3.5" strokeWidth={2.25} />
        </Button>
      ))}
    </>
  );
}
