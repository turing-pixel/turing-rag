import { formatWorkflowVariableHint } from "@/lib/workflow-variable-syntax";

describe("formatWorkflowVariableHint", () => {
  it("joins template examples without ICU placeholders", () => {
    expect(formatWorkflowVariableHint()).toBe(
      "{{input.xxx}} · {{steps.key.text}} · {{steps.key.context_text}}"
    );
  });
});
