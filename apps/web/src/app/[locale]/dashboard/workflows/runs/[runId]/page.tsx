"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { toast } from "sonner";

import { WorkflowRunDetailView } from "@/components/workflow/workflow-run-detail-view";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkflowRun, type WorkflowRun } from "@/lib/workflow";

function RunDetailSkeleton() {
  return (
    <article className="w-full space-y-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-28" />
        <div className="flex flex-col gap-4 md:flex-row md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-48 md:ml-auto" />
        </div>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <Skeleton className="min-h-80 flex-1" />
        <Skeleton className="h-48 w-full lg:w-64" />
      </div>
    </article>
  );
}

export default function WorkflowRunDetailPage() {
  const t = useTranslations("dashboard.workflows.runDetailPage");
  const locale = useLocale();
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getWorkflowRun(runId);
      setRun(data);
      return data;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("loadFailed"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [runId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const runStatus = run?.status;

  useEffect(() => {
    if (!runStatus || (runStatus !== "pending" && runStatus !== "running")) {
      return;
    }
    const timer = setInterval(async () => {
      const data = await load();
      if (data && data.status !== "pending" && data.status !== "running") {
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [runStatus, load]);

  if (loading && !run) {
    return (
      <DashboardPageContainer className="max-w-none">
        <RunDetailSkeleton />
      </DashboardPageContainer>
    );
  }

  if (!run) {
    return null;
  }

  return (
    <DashboardPageContainer className="max-w-none">
      <WorkflowRunDetailView run={run} locale={locale} />
    </DashboardPageContainer>
  );
}
