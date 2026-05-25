"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import type { WorkflowStep } from "@/lib/workflow";
import { workflowStepTypeMeta } from "@/lib/workflow-step-type-meta";
import { cn } from "@/lib/utils";

export type StepProgressStatus = "pending" | "running" | "completed" | "failed";

export interface StepProgressState {
  status: StepProgressStatus;
  error?: string;
}

interface WorkflowRunProgressProps {
  steps: WorkflowStep[];
  progress: Record<string, StepProgressState>;
  className?: string;
}

export function WorkflowRunProgress({
  steps,
  progress,
  className,
}: WorkflowRunProgressProps) {
  const t = useTranslations("dashboard.workflows");
  const tStudio = useTranslations("dashboard.workflows.studio");

  const doneCount = steps.filter(
    (s) => progress[s.key]?.status === "completed"
  ).length;
  const failedCount = steps.filter((s) => progress[s.key]?.status === "failed").length;
  const runningKey = steps.find((s) => progress[s.key]?.status === "running")?.key;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {t("testPanel.progressSummary", {
            done: doneCount,
            total: steps.length,
          })}
        </span>
        {runningKey ? (
          <span className="truncate text-primary">{runningKey}</span>
        ) : failedCount > 0 ? (
          <span className="text-destructive">
            {t("testPanel.progressFailed", { count: failedCount })}
          </span>
        ) : null}
      </div>

      <ol className="space-y-2">
        {steps.map((step, index) => {
          const state = progress[step.key] || { status: "pending" as const };
          const meta = workflowStepTypeMeta(step.type);
          const Icon = meta.icon;
          const typeLabel = tStudio(`stepTypes.${meta.labelKey}`);
          const isLast = index === steps.length - 1;

          return (
            <li key={step.key} className="relative flex gap-2.5">
              {!isLast ? (
                <span
                  className="absolute left-[15px] top-8 bottom-0 w-px bg-border"
                  aria-hidden
                />
              ) : null}

              <div
                className={cn(
                  "relative z-1 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                  state.status === "pending" && cn("border-border/60", meta.iconClass),
                  state.status === "running" && "border-primary/35 bg-card",
                  state.status === "failed" && "border-destructive/35 bg-card",
                  state.status === "completed" && "border-border/60 bg-card"
                )}
              >
                {state.status === "pending" ? (
                  <Icon className="size-4" strokeWidth={2} aria-hidden />
                ) : (
                  <StepIcon status={state.status} />
                )}
              </div>

              <div
                className={cn(
                  "min-w-0 flex-1 rounded-lg border px-3 py-2.5",
                  state.status === "running" && "border-primary/30 bg-primary/4",
                  state.status === "failed" && "border-destructive/30 bg-destructive/4",
                  state.status === "completed" && "border-border/80 bg-muted/20",
                  state.status === "pending" && "border-border/60 bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{step.key}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{typeLabel}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-medium",
                      state.status === "running" && "text-primary",
                      state.status === "failed" && "text-destructive",
                      state.status === "completed" && "text-muted-foreground",
                      state.status === "pending" && "text-muted-foreground/60"
                    )}
                  >
                    {t(`status.${state.status}`)}
                  </span>
                </div>
                {state.error ? (
                  <p className="mt-2 text-xs leading-relaxed text-destructive">{state.error}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepIcon({ status }: { status: StepProgressStatus }) {
  if (status === "running") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
  }
  if (status === "completed") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />;
  }
  if (status === "failed") {
    return <XCircle className="size-4 shrink-0 text-destructive" />;
  }
  return <Circle className="size-4 shrink-0 text-muted-foreground/40" />;
}
