"use client";

import { useEffect } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { WorkflowStepNodeAddButtons } from "@/components/workflow/workflow-step-node-add-buttons";
import { WorkflowStepNodeForm } from "@/components/workflow/workflow-step-node-form";
import { useWorkflowNodeExpand } from "@/components/workflow/workflow-studio-context";
import { Button } from "@/components/ui/button";
import { getWorkflowStepPreview } from "@/lib/workflow-step-preview";
import { workflowStepTypeMeta } from "@/lib/workflow-step-type-meta";
import {
  WORKFLOW_NODE_WIDTH,
  type WorkflowStepNodeData,
} from "@/lib/workflow-graph-utils";
import { cn } from "@/lib/utils";

const RUN_STATUS: Record<string, string> = {
  running: "running",
  completed: "completed",
  failed: "failed",
};

export function WorkflowStepNode({ id, data, selected }: NodeProps<Node<WorkflowStepNodeData>>) {
  const t = useTranslations("dashboard.workflows");
  const tStudio = useTranslations("dashboard.workflows.studio");
  const step = data.step;
  const meta = workflowStepTypeMeta(step.type);
  const Icon = meta.icon;
  const status = data.runStatus;
  const preview = getWorkflowStepPreview(step);
  const { expanded, collapse, expand, toggle } = useWorkflowNodeExpand(id);

  const typeLabel = t(`studio.stepTypes.${meta.labelKey}`);
  const statusKey = status && status !== "pending" ? RUN_STATUS[status] : null;

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, collapse]);

  return (
    <div
      className="workflow-step-node group/workflow-node relative"
      style={{ width: WORKFLOW_NODE_WIDTH }}
    >
      <WorkflowStepNodeAddButtons nodeId={id} />

      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="workflow-step-handle"
      />
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="workflow-step-handle"
      />

      <article
        className={cn(
          "cursor-grab overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-shadow active:cursor-grabbing",
          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background shadow-md",
          status === "running" && "border-primary/40",
          status === "failed" && "border-destructive/45"
        )}
      >
        <div className="flex gap-3 p-3.5">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              meta.iconClass
            )}
          >
            <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1">
              <div
                className="min-w-0 flex-1 rounded-md text-left"
                onDoubleClick={expand}
                title={tStudio("dragHint")}
              >
                <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                  {typeLabel}
                </span>
                <p className="mt-1.5 text-sm font-semibold leading-snug tracking-tight text-foreground">
                  {step.key}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="nodrag nopan nowheel -mr-1 -mt-0.5 shrink-0 text-muted-foreground"
                aria-expanded={expanded}
                aria-label={expanded ? tStudio("collapse") : tStudio("expand")}
                onClick={toggle}
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform duration-200",
                    expanded && "rotate-180"
                  )}
                />
              </Button>
            </div>

            {statusKey ? (
              <p
                className={cn(
                  "mt-2 text-[10px] font-medium",
                  status === "failed" && "text-destructive",
                  status === "running" && "text-primary",
                  status === "completed" && "text-muted-foreground"
                )}
              >
                {t(`status.${statusKey}`)}
              </p>
            ) : null}

            {!expanded ? (
              <button
                type="button"
                className="nodrag nopan nowheel mt-2 line-clamp-2 w-full text-left text-[11px] leading-relaxed text-muted-foreground hover:text-foreground"
                onClick={expand}
              >
                {preview}
              </button>
            ) : null}
          </div>
        </div>

        {expanded ? (
          <div className="nodrag nopan nowheel border-t border-border/60 bg-muted/25 px-3 pb-3 pt-2">
            <WorkflowStepNodeForm nodeId={id} step={step} onCollapse={collapse} />
          </div>
        ) : null}
      </article>

      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="workflow-step-handle"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="workflow-step-handle"
      />
    </div>
  );
}
