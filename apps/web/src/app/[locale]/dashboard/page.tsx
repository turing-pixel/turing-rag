"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Book,
  MessageSquare,
  ArrowRight,
  Plus,
  Upload,
  Brain,
  Sparkles,
  AlertCircle,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

interface Stats {
  knowledgeBases: number;
  chats: number;
}

type StatsLoadState = "loading" | "ready" | "error";

const quickActions = [
  {
    href: "/dashboard/knowledge/new",
    icon: Brain,
    titleKey: "actionCreateKb" as const,
    descKey: "actionCreateKbDesc" as const,
  },
  {
    href: "/dashboard/knowledge",
    icon: Upload,
    titleKey: "actionUpload" as const,
    descKey: "actionUploadDesc" as const,
  },
  {
    href: "/dashboard/chat/new",
    icon: Sparkles,
    titleKey: "actionChat" as const,
    descKey: "actionChatDesc" as const,
  },
] as const;

const steps = [
  {
    href: "/dashboard/knowledge/new",
    titleKey: "step1Title" as const,
    bodyKey: "step1Body" as const,
    linkKey: "step1Link" as const,
  },
  {
    href: "/dashboard/knowledge",
    titleKey: "step2Title" as const,
    bodyKey: "step2Body" as const,
    linkKey: "step2Link" as const,
  },
  {
    href: "/dashboard/chat/new",
    titleKey: "step3Title" as const,
    bodyKey: "step3Body" as const,
    linkKey: "step3Link" as const,
  },
] as const;

export default function DashboardPage() {
  const t = useTranslations("dashboard.home");
  const [stats, setStats] = useState<Stats>({ knowledgeBases: 0, chats: 0 });
  const [statsState, setStatsState] = useState<StatsLoadState>("loading");

  const loadStats = useCallback(async () => {
    setStatsState("loading");
    try {
      const [kbData, chatData] = await Promise.all([
        api.get("/api/knowledge-base"),
        api.get("/api/chat"),
      ]);

      setStats({
        knowledgeBases: Array.isArray(kbData) ? kbData.length : 0,
        chats: Array.isArray(chatData) ? chatData.length : 0,
      });
      setStatsState("ready");
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      if (error instanceof ApiError && error.status === 401) {
        return;
      }
      setStatsState("error");
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <DashboardLayout>
      <DashboardPageContainer className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("heroTitle")}
            </h1>
            <p className="text-muted-foreground">{t("heroSubtitle")}</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/knowledge/new">
              <Plus />
              {t("newKnowledgeBase")}
            </Link>
          </Button>
        </div>

        {statsState === "error" ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{t("statsError")}</AlertTitle>
            <AlertDescription>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadStats()}
              >
                {t("retryStats")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <section
          className="space-y-4"
          aria-labelledby="dashboard-stats"
          aria-busy={statsState === "loading"}
        >
          <h2 id="dashboard-stats" className="text-lg font-medium">
            {t("statsOverview")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book />
                  {t("knowledgeBases")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsState === "loading" ? (
                  <Skeleton className="h-9 w-14" />
                ) : (
                  <p className="text-3xl font-semibold tabular-nums">
                    {stats.knowledgeBases}
                  </p>
                )}
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href="/dashboard/knowledge">
                    {t("viewAllKb")}
                    <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare />
                  {t("chatSessions")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsState === "loading" ? (
                  <Skeleton className="h-9 w-14" />
                ) : (
                  <p className="text-3xl font-semibold tabular-nums">
                    {stats.chats}
                  </p>
                )}
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href="/dashboard/chat">
                    {t("viewAllChats")}
                    <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="dashboard-quick-actions">
          <h2 id="dashboard-quick-actions" className="text-lg font-medium">
            {t("quickActions")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
              <Card key={action.href}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <action.icon />
                    <Link href={action.href} className="hover:underline">
                      {t(action.titleKey)}
                    </Link>
                  </CardTitle>
                  <CardDescription>{t(action.descKey)}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-5" aria-labelledby="dashboard-how-it-works">
          <h2 id="dashboard-how-it-works" className="text-lg font-medium">
            {t("howItWorks")}
          </h2>
          <ol className="grid list-none gap-0 p-0 md:grid-cols-3 md:divide-x md:divide-border">
            {steps.map((step, index) => (
              <li
                key={step.href}
                className={cn(
                  "relative flex gap-4 px-0 py-6 first:pt-0 last:pb-0 md:flex-col md:gap-3 md:px-8 md:py-0 md:first:pl-0 md:last:pr-0",
                  index > 0 && "border-t border-border md:border-t-0"
                )}
              >
                <div className="flex shrink-0 flex-col items-center md:items-start">
                  <span
                    aria-hidden
                    className="flex size-8 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold tabular-nums text-muted-foreground"
                  >
                    {index + 1}
                  </span>
                  {index < steps.length - 1 ? (
                    <div
                      aria-hidden
                      className="mt-3 w-px flex-1 bg-border md:hidden"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="font-medium leading-snug">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t(step.bodyKey)}
                  </p>
                  <Button variant="link" className="h-auto p-0" asChild>
                    <Link href={step.href}>
                      {t(step.linkKey)}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
