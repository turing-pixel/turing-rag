import type { WorkflowStep } from "@/lib/workflow";

/** One-line summary shown when the node editor is collapsed. */
export function getWorkflowStepPreview(step: WorkflowStep): string {
  switch (step.type) {
    case "retrieve":
      return truncate(step.query_template || "未配置检索 query");
    case "llm":
      return truncate(step.prompt || "未配置 prompt");
    case "condition":
      return truncate(step.message || step.when || "条件步骤");
    case "format":
      return truncate(step.template || step.format || "输出格式化");
    default:
      return step.key;
  }
}

function truncate(text: string, max = 88): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max)}...`;
}
