"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useWorkflowStudioActions } from "@/components/workflow/workflow-studio-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STEP_TYPES } from "@/lib/workflow-graph-utils";
import type { WorkflowStep } from "@/lib/workflow";
import { formatWorkflowVariableHint } from "@/lib/workflow-variable-syntax";
import { cn } from "@/lib/utils";

interface WorkflowStepNodeFormProps {
  nodeId: string;
  step: WorkflowStep;
  onCollapse: () => void;
}

const block = "nodrag nopan nowheel";

export function WorkflowStepNodeForm({
  nodeId,
  step,
  onCollapse,
}: WorkflowStepNodeFormProps) {
  const t = useTranslations("dashboard.workflows.studio");
  const { onStepChange, onStepDelete } = useWorkflowStudioActions();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const patch = (partial: Partial<WorkflowStep>) => {
    onStepChange(nodeId, { ...step, ...partial });
  };

  return (
    <div onPointerDown={(e) => e.stopPropagation()}>
      <div className={cn("mb-3 flex items-center justify-end gap-1", block)}>
        <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onCollapse}>
          {t("collapse")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDeleteOpen(true)}
          aria-label={t("deleteStep")}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <FieldGroup className={cn("gap-3.5", block)}>
        <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2.5">
          <Field>
            <FieldLabel htmlFor={`${nodeId}-key`}>{t("stepKey")}</FieldLabel>
            <Input
              id={`${nodeId}-key`}
              value={step.key}
              onChange={(e) => patch({ key: e.target.value.trim() })}
            />
          </Field>
          <Field>
            <FieldLabel>{t("stepType")}</FieldLabel>
            <Select
              value={step.type}
              onValueChange={(v) => patch({ type: v as WorkflowStep["type"] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {step.type === "retrieve" && (
          <>
            <Field>
              <FieldLabel htmlFor={`${nodeId}-query`}>query_template</FieldLabel>
              <Textarea
                id={`${nodeId}-query`}
                rows={3}
                value={step.query_template || ""}
                onChange={(e) => patch({ query_template: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${nodeId}-topk`}>top_k</FieldLabel>
              <Input
                id={`${nodeId}-topk`}
                type="number"
                className="w-24"
                value={String(step.top_k ?? 12)}
                onChange={(e) => patch({ top_k: Number(e.target.value) })}
              />
            </Field>
          </>
        )}

        {step.type === "llm" && (
          <>
            <Field>
              <FieldLabel htmlFor={`${nodeId}-system`}>system</FieldLabel>
              <Textarea
                id={`${nodeId}-system`}
                rows={2}
                value={(step.system as string) || ""}
                onChange={(e) => patch({ system: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${nodeId}-prompt`}>prompt</FieldLabel>
              <Textarea
                id={`${nodeId}-prompt`}
                rows={4}
                value={step.prompt || ""}
                onChange={(e) => patch({ prompt: e.target.value })}
              />
            </Field>
          </>
        )}

        {step.type === "condition" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field>
                <FieldLabel>when</FieldLabel>
                <Select
                  value={(step.when as string) || "low_confidence"}
                  onValueChange={(v) => patch({ when: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low_confidence">low_confidence</SelectItem>
                    <SelectItem value="custom">custom</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`${nodeId}-retrieve-key`}>retrieve_step_key</FieldLabel>
                <Input
                  id={`${nodeId}-retrieve-key`}
                  value={(step.retrieve_step_key as string) || ""}
                  onChange={(e) => patch({ retrieve_step_key: e.target.value })}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor={`${nodeId}-message`}>message</FieldLabel>
              <Textarea
                id={`${nodeId}-message`}
                rows={2}
                value={step.message || ""}
                onChange={(e) => patch({ message: e.target.value })}
              />
            </Field>
          </>
        )}

        {step.type === "format" && (
          <>
            <Field>
              <FieldLabel htmlFor={`${nodeId}-format`}>format</FieldLabel>
              <Input
                id={`${nodeId}-format`}
                className="w-32"
                value={step.format || "markdown"}
                onChange={(e) => patch({ format: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${nodeId}-template`}>template</FieldLabel>
              <Textarea
                id={`${nodeId}-template`}
                rows={3}
                value={step.template || ""}
                onChange={(e) => patch({ template: e.target.value })}
              />
            </Field>
          </>
        )}

        <FieldDescription className="font-mono text-[11px]">
          {formatWorkflowVariableHint()}
        </FieldDescription>
      </FieldGroup>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteStepTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteStepDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deleteStepCancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false);
                onStepDelete(nodeId);
              }}
            >
              {t("deleteStepConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
