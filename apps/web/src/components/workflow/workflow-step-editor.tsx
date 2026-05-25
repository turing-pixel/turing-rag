"use client";

import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WorkflowStep } from "@/lib/workflow";

interface WorkflowStepEditorProps {
  steps: WorkflowStep[];
  onChange: (steps: WorkflowStep[]) => void;
}

export function WorkflowStepEditor({ steps, onChange }: WorkflowStepEditorProps) {
  const t = useTranslations("dashboard.workflows");

  const updateStep = (index: number, patch: Partial<WorkflowStep>) => {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{t("editSteps")}</h3>
      {steps.map((step, index) => (
        <div
          key={step.key}
          className="rounded-lg border border-border p-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{step.type}</span>
            <span>{step.key}</span>
          </div>
          {step.type === "llm" && (
            <div className="space-y-2">
              <Label>prompt</Label>
              <Textarea
                rows={6}
                value={step.prompt || ""}
                onChange={(e) => updateStep(index, { prompt: e.target.value })}
              />
            </div>
          )}
          {step.type === "retrieve" && (
            <div className="space-y-2">
              <Label>query_template</Label>
              <Textarea
                rows={3}
                value={step.query_template || ""}
                onChange={(e) =>
                  updateStep(index, { query_template: e.target.value })
                }
              />
            </div>
          )}
          {step.type === "format" && (
            <div className="space-y-2">
              <Label>template</Label>
              <Textarea
                rows={4}
                value={step.template || ""}
                onChange={(e) => updateStep(index, { template: e.target.value })}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
