import type { LucideIcon } from "lucide-react";
import { Brain, FileOutput, GitBranch, Search } from "lucide-react";

import type { WorkflowStep } from "@/lib/workflow";

export type WorkflowStepTypeMeta = {
  icon: LucideIcon;
  labelKey: "retrieve" | "llm" | "condition" | "format";
  /** Icon tile: subtle tint; card body stays neutral. */
  iconClass: string;
};

export const WORKFLOW_STEP_TYPE_META: Record<
  WorkflowStep["type"],
  WorkflowStepTypeMeta
> = {
  retrieve: {
    icon: Search,
    labelKey: "retrieve",
    iconClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  llm: {
    icon: Brain,
    labelKey: "llm",
    iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  condition: {
    icon: GitBranch,
    labelKey: "condition",
    iconClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  format: {
    icon: FileOutput,
    labelKey: "format",
    iconClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

export function workflowStepTypeMeta(type: WorkflowStep["type"]) {
  return WORKFLOW_STEP_TYPE_META[type] ?? WORKFLOW_STEP_TYPE_META.llm;
}
