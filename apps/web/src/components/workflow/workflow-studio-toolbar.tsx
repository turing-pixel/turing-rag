"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CalendarClock,
  FlaskConical,
  History,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Webhook,
} from "lucide-react";

import type { WorkflowRunDockMode } from "@/components/workflow/workflow-run-dock";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import type { WorkflowSchedule, WorkflowWebhook } from "@/lib/workflow";
import { cn } from "@/lib/utils";

export interface LlmConfigOption {
  id: number;
  name: string;
  provider: string;
  model: string;
}

export interface WorkflowRunListItem {
  uuid: string;
  status: string;
  created_at: string;
}

export interface WorkflowStudioToolbarProps {
  workflowName: string;
  templateKey: string;
  lastRunStatus?: string | null;
  llmConfigId: string;
  llmConfigs: LlmConfigOption[];
  onLlmConfigChange: (id: string) => void;
  saving?: boolean;
  running?: boolean;
  onSave: () => void | Promise<void>;
  onResetTemplate: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onProductionRun: () => void | Promise<void>;
  runs: WorkflowRunListItem[];
  webhooks: WorkflowWebhook[];
  schedules: WorkflowSchedule[];
  webhookUrl: string;
  onWebhookUrlChange: (url: string) => void;
  cronExpr: string;
  onCronExprChange: (expr: string) => void;
  onAddWebhook: () => void | Promise<void>;
  onAddSchedule: () => void | Promise<void>;
  onAddStep: () => void;
  runDockMode?: WorkflowRunDockMode | null;
  onToggleRunDock?: (mode: WorkflowRunDockMode) => void;
  className?: string;
}

export function WorkflowStudioToolbar({
  workflowName,
  lastRunStatus,
  llmConfigId,
  llmConfigs,
  onLlmConfigChange,
  saving,
  running,
  onSave,
  onResetTemplate,
  onDelete,
  runs,
  webhooks,
  schedules,
  webhookUrl,
  onWebhookUrlChange,
  cronExpr,
  onCronExprChange,
  onAddWebhook,
  onAddSchedule,
  onAddStep,
  runDockMode,
  onToggleRunDock,
  className,
}: WorkflowStudioToolbarProps) {
  const t = useTranslations("dashboard.workflows");
  const [runsOpen, setRunsOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "flex h-11 shrink-0 items-center gap-2 bg-background px-2 sm:px-3",
          className
        )}
      >
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/dashboard/workflows" aria-label={t("title")}>
            <ArrowLeft />
          </Link>
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-sm font-medium">{workflowName}</h1>
          {lastRunStatus ? <Badge variant="outline">{lastRunStatus}</Badge> : null}
        </div>

        <Select value={llmConfigId || "default"} onValueChange={onLlmConfigChange}>
          <SelectTrigger size="sm">
            <SelectValue placeholder={t("toolbar.llm")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t("toolbar.llmDefault")}</SelectItem>
            {llmConfigs.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Spinner /> : <Save />}
          {t("save")}
        </Button>

        <Button
          variant={runDockMode === "test" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onToggleRunDock?.("test")}
        >
          <FlaskConical />
          {t("studio.test")}
        </Button>

        <Button
          variant={runDockMode === "run" ? "default" : "outline"}
          size="sm"
          onClick={() => onToggleRunDock?.("run")}
          disabled={running && runDockMode !== "run"}
        >
          {running && runDockMode === "run" ? <Spinner /> : <Play />}
          {t("run")}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm">
              <MoreHorizontal />
              <span className="sr-only">{t("toolbar.more")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAddStep}>
              <Plus />
              {t("studio.addStep")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRunsOpen(true)}>
              <History />
              {t("runs")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAutomationOpen(true)}>
              <Webhook />
              {t("toolbar.automation")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onResetTemplate}>
              <RotateCcw />
              {t("resetTemplate")}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <Sheet open={runsOpen} onOpenChange={setRunsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("runs")}</SheetTitle>
            <SheetDescription>{t("toolbar.runsDescription")}</SheetDescription>
          </SheetHeader>
          <ScrollArea>
            <ItemGroup>
              {runs.length === 0 ? (
                <SheetDescription>{t("toolbar.noRuns")}</SheetDescription>
              ) : (
                runs.map((r) => (
                  <Item key={r.uuid} variant="outline" size="sm" asChild>
                    <Link
                      href={`/dashboard/workflows/runs/${r.uuid}`}
                      onClick={() => setRunsOpen(false)}
                    >
                      <ItemContent>
                        <ItemTitle>
                          {new Date(r.created_at).toLocaleString()}
                        </ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <Badge variant="outline">{r.status}</Badge>
                      </ItemActions>
                    </Link>
                  </Item>
                ))
              )}
            </ItemGroup>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Sheet open={automationOpen} onOpenChange={setAutomationOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("toolbar.automation")}</SheetTitle>
            <SheetDescription>{t("toolbar.automationDescription")}</SheetDescription>
          </SheetHeader>
          <ScrollArea>
            <FieldGroup>
              <Field>
                <FieldLabel>{t("webhooks")}</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://..."
                    value={webhookUrl}
                    onChange={(e) => onWebhookUrlChange(e.target.value)}
                  />
                  <Button variant="secondary" onClick={onAddWebhook}>
                    {t("addWebhook")}
                  </Button>
                </div>
                {webhooks.map((h) => (
                  <ItemDescription key={h.id}>{h.url}</ItemDescription>
                ))}
              </Field>
              <Field>
                <FieldLabel>{t("schedules")}</FieldLabel>
                <Input value={cronExpr} onChange={(e) => onCronExprChange(e.target.value)} />
                <Button variant="secondary" onClick={onAddSchedule}>
                  <CalendarClock />
                  {t("addSchedule")}
                </Button>
                {schedules.map((s) => (
                  <Item key={s.uuid} variant="outline" size="sm">
                    <ItemContent>
                      <ItemTitle>{s.name}</ItemTitle>
                      <ItemDescription>{s.cron_expression}</ItemDescription>
                      {s.next_run_at ? (
                        <ItemDescription>
                          {t("toolbar.nextRun")}:{" "}
                          {new Date(s.next_run_at).toLocaleString()}
                        </ItemDescription>
                      ) : null}
                    </ItemContent>
                  </Item>
                ))}
              </Field>
            </FieldGroup>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("toolbar.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("toolbar.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("toolbar.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false);
                void onDelete();
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
