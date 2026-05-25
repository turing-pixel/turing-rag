"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  Play,
  RotateCcw,
  Square,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { WorkflowInputForm } from "@/components/workflow/workflow-input-form";
import { WorkflowMarkdownOutput } from "@/components/workflow/workflow-markdown-output";
import type { StepProgressState } from "@/components/workflow/workflow-run-progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { extractCustomerReplyBody } from "@/lib/customer-reply-output";
import { runWorkflowStream } from "@/lib/workflow-run-stream";
import type { WorkflowStep } from "@/lib/workflow";

export type WorkflowRunDockMode = "test" | "run";

export interface WorkflowRunDockProps {
  mode: WorkflowRunDockMode;
  onModeChange: (mode: WorkflowRunDockMode) => void;
  onClose: () => void;
  workflowUuid: string;
  templateKey?: string;
  steps: WorkflowStep[];
  inputSchema?: Record<string, unknown>;
  runInput: Record<string, unknown>;
  onRunInputChange: (value: Record<string, unknown>) => void;
  onRunStatusChange?: (statusByKey: Record<string, StepProgressState["status"]>) => void;
  onTestRunComplete?: (runUuid: string | null) => void;
  onBeforeTest?: () => Promise<void>;
  productionRunning?: boolean;
  productionProgress?: Record<string, StepProgressState>;
  onProductionRun?: () => void | Promise<void>;
}

function RunProgressCompact({
  steps,
  progress,
}: {
  steps: WorkflowStep[];
  progress: Record<string, StepProgressState>;
}) {
  const t = useTranslations("dashboard.workflows");

  const doneCount = steps.filter((s) => progress[s.key]?.status === "completed").length;
  const failedSteps = steps.filter((s) => progress[s.key]?.status === "failed");
  const runningStep = steps.find((s) => progress[s.key]?.status === "running");

  return (
    <div className="space-y-2 rounded-md border bg-muted/15 px-3 py-2.5 text-xs">
      <p className="text-muted-foreground">
        {t("testPanel.progressSummary", { done: doneCount, total: steps.length })}
      </p>
      {runningStep ? (
        <p className="flex items-center gap-1.5 text-primary">
          <Loader2 className="size-3 shrink-0 animate-spin" />
          <span className="truncate font-medium">{runningStep.key}</span>
        </p>
      ) : null}
      {failedSteps.map((step) => (
        <p key={step.key} className="flex items-start gap-1.5 text-destructive">
          <XCircle className="mt-0.5 size-3 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium">{step.key}</span>
            {progress[step.key]?.error ? (
              <span className="mt-0.5 block text-[11px] leading-snug opacity-90">
                {progress[step.key]?.error}
              </span>
            ) : null}
          </span>
        </p>
      ))}
      {!runningStep && failedSteps.length === 0 && doneCount === steps.length && steps.length > 0 ? (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 className="size-3 shrink-0 text-emerald-600 dark:text-emerald-500" />
          {t("status.completed")}
        </p>
      ) : null}
    </div>
  );
}

export function WorkflowRunDock({
  mode,
  onModeChange,
  onClose,
  workflowUuid,
  templateKey,
  steps,
  inputSchema,
  runInput,
  onRunInputChange,
  onRunStatusChange,
  onTestRunComplete,
  onBeforeTest,
  productionRunning,
  productionProgress,
  onProductionRun,
}: WorkflowRunDockProps) {
  const t = useTranslations("dashboard.workflows");
  const [testRunning, setTestRunning] = useState(false);
  const [hasTestRun, setHasTestRun] = useState(false);
  const [testProgress, setTestProgress] = useState<Record<string, StepProgressState>>({});
  const [outputText, setOutputText] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runUuid, setRunUuid] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const initialProgress = useMemo(() => {
    const map: Record<string, StepProgressState> = {};
    for (const step of steps) {
      map[step.key] = { status: "pending" };
    }
    return map;
  }, [steps]);

  const canRun = useMemo(() => {
    if (testRunning || productionRunning || steps.length === 0) return false;
    const required = (inputSchema?.required as string[]) || [];
    return required.every((key) => {
      const v = runInput[key];
      return v !== undefined && v !== null && String(v).trim() !== "";
    });
  }, [testRunning, productionRunning, steps.length, inputSchema, runInput]);

  const displayOutput =
    templateKey === "customer_reply" && outputText
      ? extractCustomerReplyBody(outputText)
      : outputText;

  const resetTestState = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setTestRunning(false);
    setHasTestRun(false);
    setTestProgress({});
    setOutputText(null);
    setRunError(null);
    setRunUuid(null);
    onRunStatusChange?.({});
  }, [onRunStatusChange]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (displayOutput && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [displayOutput]);

  const handleTestRun = async () => {
    setTestRunning(true);
    setHasTestRun(true);
    setOutputText(null);
    setRunError(null);
    setRunUuid(null);
    const progress = { ...initialProgress };
    setTestProgress(progress);

    const statusMap: Record<string, StepProgressState["status"]> = {};
    for (const key of Object.keys(progress)) {
      statusMap[key] = "pending";
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (onBeforeTest) {
        await onBeforeTest();
      }
      const uuid = await runWorkflowStream({
        workflowUuid,
        input: runInput,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "step_start" && event.step_key) {
            progress[event.step_key] = { status: "running" };
            statusMap[event.step_key] = "running";
            setTestProgress({ ...progress });
            onRunStatusChange?.({ ...statusMap });
          }
          if (event.type === "step_complete" && event.step_key) {
            progress[event.step_key] = { status: "completed" };
            statusMap[event.step_key] = "completed";
            setTestProgress({ ...progress });
            onRunStatusChange?.({ ...statusMap });
          }
          if (event.type === "step_failed" && event.step_key) {
            progress[event.step_key] = {
              status: "failed",
              error: event.error,
            };
            statusMap[event.step_key] = "failed";
            setTestProgress({ ...progress });
            onRunStatusChange?.({ ...statusMap });
          }
          if (event.type === "run_complete") {
            const out = event.output as { text?: string } | undefined;
            if (out?.text) {
              setOutputText(out.text);
            }
            if (event.run_uuid) {
              setRunUuid(event.run_uuid);
            }
          }
          if (event.run_uuid) {
            setRunUuid(event.run_uuid);
          }
        },
      });
      onTestRunComplete?.(uuid);
      if (uuid) {
        setRunUuid(uuid);
        toast.success(t("testPanel.completed"));
      }
    } catch (e) {
      if (controller.signal.aborted) {
        return;
      }
      const msg = e instanceof Error ? e.message : t("testPanel.failed");
      setRunError(msg);
      toast.error(msg);
      onRunStatusChange?.({});
    } finally {
      setTestRunning(false);
      abortRef.current = null;
    }
  };

  const handleTestStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setTestRunning(false);
    toast.message(t("testPanel.stopped"));
  };

  const handleCopyOutput = async () => {
    if (!displayOutput) return;
    try {
      await navigator.clipboard.writeText(displayOutput);
      toast.success(t("copyOutput"));
    } catch {
      toast.error(t("testPanel.copyFailed"));
    }
  };

  const productionProgressMap = productionProgress ?? {};
  const showProductionProgress =
    productionRunning && Object.keys(productionProgressMap).length > 0;

  return (
    <aside
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background"
      aria-label={t("dock.title")}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="text-sm font-medium">{t("dock.title")}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label={t("dock.close")}
        >
          <X className="size-4" />
        </Button>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => onModeChange(v as WorkflowRunDockMode)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="mx-3 mt-2 grid w-auto grid-cols-2">
          <TabsTrigger value="test" className="gap-1.5 text-xs">
            <FlaskConical className="size-3.5" />
            {t("dock.tabTest")}
          </TabsTrigger>
          <TabsTrigger value="run" className="gap-1.5 text-xs">
            <Play className="size-3.5" />
            {t("dock.tabRun")}
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 px-3 py-3">
            {steps.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                {t("testPanel.noSteps")}
              </p>
            ) : inputSchema ? (
              <WorkflowInputForm
                schema={inputSchema}
                value={runInput}
                onChange={onRunInputChange}
              />
            ) : null}

            {steps.length > 0 && mode === "test" ? (
              <>
                {hasTestRun || testRunning ? (
                  <RunProgressCompact steps={steps} progress={testProgress} />
                ) : null}

                {runError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {runError}
                  </p>
                ) : null}

                {hasTestRun && !testRunning && !displayOutput && !runError ? (
                  <p className="text-sm text-muted-foreground">{t("testPanel.emptyOutput")}</p>
                ) : null}

                {displayOutput ? (
                  <div className="space-y-2">
                    <div
                      ref={outputRef}
                      className="max-h-56 overflow-y-auto rounded-md border bg-card p-2.5 text-sm shadow-sm"
                    >
                      <WorkflowMarkdownOutput content={displayOutput} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => void handleCopyOutput()}
                      >
                        <Copy className="size-3.5" />
                        {t("copyOutput")}
                      </Button>
                      {runUuid ? (
                        <Button variant="link" className="h-7 px-0 text-xs" asChild>
                          <Link href={`/dashboard/workflows/runs/${runUuid}`}>
                            <ExternalLink className="size-3.5" />
                            {t("testPanel.viewRun")}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {steps.length > 0 && mode === "run" && showProductionProgress ? (
              <RunProgressCompact steps={steps} progress={productionProgressMap} />
            ) : null}
            </div>
          </ScrollArea>
        </div>

        {steps.length > 0 ? (
          <div className="shrink-0 border-t px-3 py-2.5">
            {mode === "test" ? (
              <div className="flex gap-2">
                {testRunning ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    size="sm"
                    onClick={handleTestStop}
                  >
                    <Square className="size-4" />
                    {t("testPanel.stop")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="flex-1"
                    size="sm"
                    disabled={!canRun}
                    onClick={() => void handleTestRun()}
                  >
                    <Play className="size-4" />
                    {t("testPanel.run")}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={testRunning}
                  onClick={resetTestState}
                  aria-label={t("testPanel.reset")}
                >
                  <RotateCcw className="size-4" />
                </Button>
                {displayOutput && !testRunning ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setOutputText(null)}
                    aria-label={t("testPanel.clearOutput")}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                className="w-full"
                size="sm"
                disabled={!canRun || productionRunning}
                onClick={() => void onProductionRun?.()}
              >
                {productionRunning ? (
                  <Spinner className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                {t("run")}
              </Button>
            )}
          </div>
        ) : null}
      </Tabs>
    </aside>
  );
}
