"use client";

import { useTranslations } from "next-intl";
import { GitBranch } from "lucide-react";

import { RagPipelineFlow } from "@/components/rag/rag-pipeline-flow";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { Badge } from "@/components/ui/badge";

const LEGEND_KINDS = ["api", "service", "storage", "optional"] as const;

export default function RagPipelinePage() {
  const t = useTranslations("dashboard.rag");

  return (
    <DashboardPageContainer className="max-w-none space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <GitBranch className="size-5 text-primary" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {t("description")}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("legendTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {LEGEND_KINDS.map((kind) => (
                <Badge key={kind} variant="outline" className="font-normal">
                  {t(`legend.${kind}`)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="h-[min(85vh,1040px)] min-h-[800px]">
          <RagPipelineFlow />
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">{t("summariesTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("lanes.ingestion")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("summaries.ingestion")}
            </p>
          </section>
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("lanes.chat")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("summaries.chat")}
            </p>
          </section>
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("lanes.retrieval")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("summaries.retrieval")}
            </p>
          </section>
          </div>
        </div>
    </DashboardPageContainer>
  );
}
