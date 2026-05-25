"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { WorkflowStudio } from "@/components/workflow/workflow-studio";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { runWorkflowStream } from "@/lib/workflow-run-stream";
import {
  deleteWorkflow,
  getWorkflow,
  listWorkflowRuns,
  listWorkflowSchedules,
  listWorkflowTemplates,
  listWorkflowWebhooks,
  resetWorkflowFromTemplate,
  updateWorkflow,
  type WorkflowDefinition,
  type WorkflowGraph,
  type WorkflowSchedule,
  type WorkflowStep,
  type WorkflowTemplate,
  type WorkflowWebhook,
} from "@/lib/workflow";
import type { StepProgressState } from "@/components/workflow/workflow-run-progress";
import type { LlmConfigOption } from "@/components/workflow/workflow-studio-toolbar";

export default function WorkflowDetailPage() {
  const t = useTranslations("dashboard.workflows");
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  useEffect(() => {
    if (id === "runs" || id === "new") {
      router.replace(id === "new" ? "/dashboard/workflows/new" : "/dashboard/workflows");
    }
  }, [id, router]);

  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [runInput, setRunInput] = useState<Record<string, unknown>>({});
  const [webhookUrl, setWebhookUrl] = useState("");
  const [cronExpr, setCronExpr] = useState("0 9 * * 1");
  const [webhooks, setWebhooks] = useState<WorkflowWebhook[]>([]);
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([]);
  const [runs, setRuns] = useState<
    Array<{ uuid: string; status: string; created_at: string }>
  >([]);
  const [llmConfigs, setLlmConfigs] = useState<LlmConfigOption[]>([]);
  const [llmConfigId, setLlmConfigId] = useState<string>("");
  const [stepProgress, setStepProgress] = useState<Record<string, StepProgressState>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialProgress = useMemo(() => {
    const map: Record<string, StepProgressState> = {};
    for (const step of steps) {
      map[step.key] = { status: "pending" };
    }
    return map;
  }, [steps]);

  const load = useCallback(async () => {
    if (id === "runs" || id === "new") return;
    setLoading(true);
    try {
      const [wf, tpls, runList, hookList, scheduleList, llmList] = await Promise.all([
        getWorkflow(id),
        listWorkflowTemplates(),
        listWorkflowRuns(id),
        listWorkflowWebhooks(id).catch(() => [] as WorkflowWebhook[]),
        listWorkflowSchedules(id).catch(() => [] as WorkflowSchedule[]),
        api.get("/api/llm-configs") as Promise<LlmConfigOption[]>,
      ]);
      const tpl = tpls.find((x) => x.key === wf.template_key) || null;
      setWorkflow(wf);
      setTemplate(tpl);
      setSteps(wf.resolved_steps || []);
      setGraph(wf.graph || tpl?.default_graph || null);
      setRuns(runList);
      setWebhooks(hookList);
      setSchedules(scheduleList);
      setLlmConfigs(llmList);
      setLlmConfigId(wf.llm_config_id ? String(wf.llm_config_id) : "");
      const defaults: Record<string, unknown> = {};
      const props = (tpl?.input_schema?.properties || {}) as Record<
        string,
        { default?: unknown }
      >;
      for (const [k, v] of Object.entries(props)) {
        if (v.default !== undefined) defaults[k] = v.default;
      }
      if (wf.template_key === "customer_reply") {
        defaults.customer_context = defaults.customer_context ?? "";
        defaults.product_line = defaults.product_line ?? "";
      }
      setRunInput(defaults);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const persistWorkflow = useCallback(async () => {
    if (!workflow) return;
    return updateWorkflow(workflow.uuid, {
      resolved_steps: steps,
      graph: graph || undefined,
      llm_config_id:
        llmConfigId && llmConfigId !== "default" ? Number(llmConfigId) : null,
    });
  }, [workflow, steps, graph, llmConfigId]);

  const handleSave = async () => {
    if (!workflow) return;
    setSaving(true);
    try {
      const updated = await persistWorkflow();
      if (updated) {
        setWorkflow(updated);
        toast.success(t("toolbar.saved"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleBeforeTest = useCallback(async () => {
    if (!workflow) return;
    const updated = await persistWorkflow();
    if (updated) {
      setWorkflow(updated);
    }
  }, [workflow, persistWorkflow]);

  const handleRun = async () => {
    if (!workflow) return;
    setRunning(true);
    setStepProgress({ ...initialProgress });
    try {
      await persistWorkflow();
      const runUuid = await runWorkflowStream({
        workflowUuid: workflow.uuid,
        input: runInput,
        onEvent: (event) => {
          if (event.type === "step_start" && event.step_key) {
            setStepProgress((prev) => ({
              ...prev,
              [event.step_key!]: { status: "running" },
            }));
          }
          if (event.type === "step_complete" && event.step_key) {
            setStepProgress((prev) => ({
              ...prev,
              [event.step_key!]: { status: "completed" },
            }));
          }
          if (event.type === "step_failed" && event.step_key) {
            setStepProgress((prev) => ({
              ...prev,
              [event.step_key!]: { status: "failed", error: event.error },
            }));
          }
        },
      });
      if (runUuid) {
        router.push(`/dashboard/workflows/runs/${runUuid}`);
      } else {
        toast.error("Run finished without run id");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!workflow) return;
    try {
      const updated = await resetWorkflowFromTemplate(workflow.uuid);
      setWorkflow(updated);
      setSteps(updated.resolved_steps || []);
      setGraph(updated.graph || template?.default_graph || null);
      toast.success(t("resetTemplate"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    }
  };

  const handleDelete = async () => {
    if (!workflow) return;
    try {
      await deleteWorkflow(workflow.uuid);
      toast.success(t("toolbar.deleted"));
      router.push("/dashboard/workflows");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleAddWebhook = async () => {
    if (!workflow || !webhookUrl.trim()) return;
    try {
      await api.post(`/api/workflows/${workflow.uuid}/webhooks`, {
        url: webhookUrl.trim(),
        events: ["run.completed", "run.failed"],
      });
      toast.success(t("toolbar.webhookAdded"));
      setWebhookUrl("");
      setWebhooks(await listWorkflowWebhooks(workflow.uuid));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Webhook failed");
    }
  };

  const handleAddSchedule = async () => {
    if (!workflow) return;
    try {
      await api.post(`/api/workflows/${workflow.uuid}/schedules`, {
        name: `${workflow.name} schedule`,
        cron_expression: cronExpr,
        input_defaults: runInput,
      });
      toast.success(t("toolbar.scheduleAdded"));
      setSchedules(await listWorkflowSchedules(workflow.uuid));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Schedule failed");
    }
  };

  if (loading || !workflow) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <WorkflowStudio
          fullWidth
          graph={graph}
          steps={steps}
          onChange={({ graph: g, steps: s }) => {
            setGraph(g);
            setSteps(s);
          }}
          workflowUuid={workflow.uuid}
          templateKey={workflow.template_key}
          inputSchema={template?.input_schema}
          runInput={runInput}
          onRunInputChange={setRunInput}
          onBeforeTest={handleBeforeTest}
          toolbar={{
            workflowName: workflow.name,
            templateKey: workflow.template_key,
            lastRunStatus: workflow.last_run_status,
            llmConfigId,
            llmConfigs,
            onLlmConfigChange: setLlmConfigId,
            saving,
            running,
            onSave: handleSave,
            onResetTemplate: handleResetTemplate,
            onDelete: handleDelete,
            onProductionRun: handleRun,
            runs,
            webhooks,
            schedules,
            webhookUrl,
            onWebhookUrlChange: setWebhookUrl,
            cronExpr,
            onCronExprChange: setCronExpr,
            onAddWebhook: handleAddWebhook,
            onAddSchedule: handleAddSchedule,
            stepProgress,
          }}
        />
    </div>
  );
}
