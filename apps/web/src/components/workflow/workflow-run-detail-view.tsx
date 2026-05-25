"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowLeft } from "lucide-react";

import {
  useWorkflowRunOutputSection,
  WorkflowRunOutputPanel,
} from "@/components/workflow/workflow-run-output-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldLegend } from "@/components/ui/field";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Link } from "@/i18n/navigation";
import { extractCustomerReplyBody } from "@/lib/customer-reply-output";
import type { WorkflowRun, WorkflowRunStep } from "@/lib/workflow";
import type { WorkflowStep } from "@/lib/workflow";
import { workflowStepTypeMeta } from "@/lib/workflow-step-type-meta";

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "failed") return "destructive";
  if (status === "completed") return "default";
  if (status === "running") return "secondary";
  return "outline";
}

function formatRunTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function RunStepRow({ step }: { step: WorkflowRunStep }) {
  const t = useTranslations("dashboard.workflows");
  const tPage = useTranslations("dashboard.workflows.runDetailPage");
  const tStudio = useTranslations("dashboard.workflows.studio");
  const meta = workflowStepTypeMeta(step.step_type as WorkflowStep["type"]);

  const metaLine = [
    tStudio(`stepTypes.${meta.labelKey}`),
    step.duration_ms != null ? tPage("duration", { ms: step.duration_ms }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Item size="xs">
      <ItemContent>
        <div className="flex items-center justify-between gap-2">
          <ItemTitle>{step.step_key}</ItemTitle>
          <Badge variant={statusBadgeVariant(step.status)}>
            {t(`status.${step.status}`)}
          </Badge>
        </div>
        <ItemDescription>{metaLine}</ItemDescription>
        {step.error_message ? (
          <ItemDescription>{step.error_message}</ItemDescription>
        ) : null}
      </ItemContent>
    </Item>
  );
}

function RunStepsSidebar({
  steps,
  summary,
}: {
  steps: WorkflowRunStep[];
  summary: { completed: number; failed: number; total: number };
}) {
  const tPage = useTranslations("dashboard.workflows.runDetailPage");

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-64 xl:w-72">
      <section className="flex flex-col gap-2">
        <div className="space-y-0.5">
          <FieldLegend variant="label">{tPage("stepsTitle")}</FieldLegend>
          <FieldDescription>
            {tPage("stepsSummary", {
              done: summary.completed,
              total: summary.total,
            })}
            {summary.failed > 0
              ? ` · ${tPage("stepsFailed", { count: summary.failed })}`
              : null}
          </FieldDescription>
        </div>
        <Item variant="outline" size="sm">
          <ItemGroup>
            {steps.map((step) => (
              <RunStepRow key={step.step_key} step={step} />
            ))}
          </ItemGroup>
        </Item>
      </section>
    </aside>
  );
}

export interface WorkflowRunDetailViewProps {
  run: WorkflowRun;
  locale: string;
}

export function WorkflowRunDetailView({ run, locale }: WorkflowRunDetailViewProps) {
  const t = useTranslations("dashboard.workflows");
  const tPage = useTranslations("dashboard.workflows.runDetailPage");

  const outputText =
    (run.output?.text as string) || JSON.stringify(run.output ?? {}, null, 2);
  const isCustomerReply = run.template_key === "customer_reply";
  const replyBody = isCustomerReply ? extractCustomerReplyBody(outputText) : outputText;
  const outputFormat = (run.output?.format as string) || "text";
  const showFullReport = isCustomerReply && replyBody !== outputText && outputText.trim();
  const exportBasename = `workflow-run-${run.uuid.slice(0, 8)}`;

  const primaryExportTitle = isCustomerReply ? tPage("tabReply") : tPage("tabOutput");

  const primaryOutput = useWorkflowRunOutputSection({
    exportTitle: primaryExportTitle,
    content: isCustomerReply ? replyBody : outputText,
    outputFormat,
    exportBasename,
    emptyLabel: tPage("noOutput"),
    copyLabel: isCustomerReply ? t("copyReplyBody") : t("copyOutput"),
  });

  const stepsSummary = useMemo(() => {
    const completed = run.steps.filter((s) => s.status === "completed").length;
    const failed = run.steps.filter((s) => s.status === "failed").length;
    return { completed, failed, total: run.steps.length };
  }, [run.steps]);

  const fullReportConfig = showFullReport
    ? {
        exportTitle: tPage("tabFullReport"),
        content: outputText,
        outputFormat,
        exportBasename: `${exportBasename}-full`,
        emptyLabel: tPage("noOutput"),
        copyLabel: t("copyOutput"),
      }
    : undefined;

  return (
    <article className="w-full space-y-6">
      <header className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/workflows/${run.workflow_uuid}`}>
            <ArrowLeft />
            {tPage("backToWorkflow")}
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{t("runDetail")}</h1>
              <Badge variant={statusBadgeVariant(run.status)}>
                {t(`status.${run.status}`)}
              </Badge>
            </div>
            <FieldDescription>
              {tPage("runMeta", {
                template: run.template_key,
                time: formatRunTime(run.created_at, locale),
              })}
            </FieldDescription>
          </div>
          <div className="w-full shrink-0 md:w-auto">{primaryOutput.toolbar}</div>
        </div>
      </header>

      {run.error_message ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{tPage("runFailed")}</AlertTitle>
          <AlertDescription>{run.error_message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
          <WorkflowRunOutputPanel
            primaryBody={primaryOutput.body}
            fullReport={fullReportConfig}
          />
        </div>

        {run.steps.length > 0 ? (
          <RunStepsSidebar steps={run.steps} summary={stepsSummary} />
        ) : null}
      </div>
    </article>
  );
}
