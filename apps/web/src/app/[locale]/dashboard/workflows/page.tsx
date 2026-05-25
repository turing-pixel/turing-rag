"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Workflow } from "lucide-react";
import { toast } from "sonner";

import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { listWorkflows, type WorkflowDefinition } from "@/lib/workflow";

export default function WorkflowsPage() {
  const t = useTranslations("dashboard.workflows");
  const [items, setItems] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listWorkflows());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardPageContainer>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/workflows/new">
            <Plus className="size-4" />
            {t("new")}
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Workflow className="size-10 text-muted-foreground" />
            <p className="text-muted-foreground">{t("empty")}</p>
            <Button asChild variant="outline">
              <Link href="/dashboard/workflows/new">{t("new")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((wf) => (
            <Link key={wf.uuid} href={`/dashboard/workflows/${wf.uuid}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{wf.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{wf.template_key}</p>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  {wf.last_run_status ? (
                    <Badge variant="secondary">{wf.last_run_status}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardPageContainer>
  );
}
