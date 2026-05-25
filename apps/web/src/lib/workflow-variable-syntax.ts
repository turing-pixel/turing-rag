/** Workflow template placeholders (not passed through next-intl — `{{` breaks ICU). */
export const WORKFLOW_VARIABLE_EXAMPLES = [
  "{{input.xxx}}",
  "{{steps.key.text}}",
  "{{steps.key.context_text}}",
] as const;

export function formatWorkflowVariableHint(separator = " · "): string {
  return WORKFLOW_VARIABLE_EXAMPLES.join(separator);
}
