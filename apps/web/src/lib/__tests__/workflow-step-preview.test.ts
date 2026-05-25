import { getWorkflowStepPreview } from "@/lib/workflow-step-preview";
import type { WorkflowStep } from "@/lib/workflow";

describe("getWorkflowStepPreview", () => {
  it("truncates long llm prompt", () => {
    const step: WorkflowStep = {
      key: "draft",
      type: "llm",
      prompt: "a".repeat(80),
    };
    expect(getWorkflowStepPreview(step)).toMatch(/\.\.\.$/);
    expect(getWorkflowStepPreview(step).length).toBeLessThanOrEqual(91);
  });

  it("shows retrieve query template", () => {
    const step: WorkflowStep = {
      key: "search",
      type: "retrieve",
      query_template: "{{input.question}}",
    };
    expect(getWorkflowStepPreview(step)).toBe("{{input.question}}");
  });
});
