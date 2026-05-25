"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Copy, Download, FileCode, FileText } from "lucide-react";
import { toast } from "sonner";

import { WorkflowMarkdownOutput } from "@/components/workflow/workflow-markdown-output";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldDescription } from "@/components/ui/field";
import { Item, ItemContent } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  buildWorkflowExportHtml,
  exportWorkflowDocx,
  exportWorkflowHtml,
  exportWorkflowPdf,
  shouldRenderMarkdown,
} from "@/lib/workflow-run-export";

type OutputView = "preview" | "source";

export interface WorkflowRunOutputSectionConfig {
  /** Used for export document title only */
  exportTitle: string;
  content: string;
  outputFormat?: string;
  exportBasename: string;
  emptyLabel: string;
  copyLabel?: string;
}

function WorkflowRunOutputToolbar({
  markdownMode,
  view,
  onViewChange,
  onCopy,
  copyTooltip,
  onExport,
  exporting,
  disabled,
}: {
  markdownMode: boolean;
  view: OutputView;
  onViewChange: (view: OutputView) => void;
  onCopy: () => void;
  copyTooltip: string;
  onExport: (format: "html" | "pdf" | "docx") => void;
  exporting: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("dashboard.workflows.runDetailPage");

  if (disabled) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {markdownMode ? (
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => {
            if (value === "preview" || value === "source") {
              onViewChange(value);
            }
          }}
          variant="outline"
          size="sm"
          spacing={0}
        >
          <ToggleGroupItem value="preview">{t("viewPreview")}</ToggleGroupItem>
          <ToggleGroupItem value="source">{t("viewSource")}</ToggleGroupItem>
        </ToggleGroup>
      ) : null}
      {markdownMode ? (
        <div className="flex h-8 items-center">
          <Separator orientation="vertical" />
        </div>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={onCopy}>
            <Copy />
            <span className="sr-only">{copyTooltip}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copyTooltip}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={exporting}>
            <Download />
            <span className="sr-only">{t("export")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport("html")}>
            <FileCode />
            {t("exportHtml")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("pdf")}>
            <FileText />
            {t("exportPdf")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("docx")}>
            <FileText />
            {t("exportDocx")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function useWorkflowRunOutputSection(config: WorkflowRunOutputSectionConfig) {
  const t = useTranslations("dashboard.workflows");
  const tPage = useTranslations("dashboard.workflows.runDetailPage");
  const previewRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<OutputView>("preview");

  const { exportTitle, content, outputFormat, exportBasename, emptyLabel, copyLabel } =
    config;

  const hasContent = Boolean(content.trim());
  const markdownMode = shouldRenderMarkdown(content, outputFormat);
  const resolvedCopyLabel = copyLabel ?? t("copyOutput");

  const handleCopy = async () => {
    if (!hasContent) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success(tPage("copyDone"));
    } catch {
      toast.error(t("testPanel.copyFailed"));
    }
  };

  const runExport = async (format: "html" | "pdf" | "docx") => {
    if (!hasContent) return;
    setExporting(true);
    try {
      const previewHtml = previewRef.current?.innerHTML ?? "";
      if (format === "docx") {
        await exportWorkflowDocx(content, exportBasename);
        toast.success(tPage("exportDocxDone"));
        return;
      }
      const documentHtml = await buildWorkflowExportHtml(
        exportTitle,
        content,
        markdownMode ? previewHtml : undefined
      );
      if (format === "html") {
        exportWorkflowHtml(documentHtml, exportBasename);
        toast.success(tPage("exportHtmlDone"));
        return;
      }
      exportWorkflowPdf(documentHtml);
      toast.message(tPage("exportPdfHint"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : tPage("exportFailed");
      toast.error(msg === "popup_blocked" ? tPage("exportPopupBlocked") : msg);
    } finally {
      setExporting(false);
    }
  };

  const toolbar = (
    <WorkflowRunOutputToolbar
      markdownMode={markdownMode}
      view={view}
      onViewChange={setView}
      onCopy={() => void handleCopy()}
      copyTooltip={resolvedCopyLabel}
      onExport={(format) => void runExport(format)}
      exporting={exporting}
      disabled={!hasContent}
    />
  );

  const body: ReactNode = !hasContent ? (
    <FieldDescription>{emptyLabel}</FieldDescription>
  ) : (
    <Item variant="outline">
      <ItemContent>
        {markdownMode ? (
          <>
            <div ref={previewRef} hidden={view !== "preview"}>
              <WorkflowMarkdownOutput content={content} />
            </div>
            {view === "source" ? <Textarea readOnly value={content} rows={14} /> : null}
          </>
        ) : (
          <Textarea readOnly value={content} rows={14} />
        )}
      </ItemContent>
    </Item>
  );

  return { toolbar, body, hasContent };
}

export function WorkflowRunFullReportSection({
  config,
  showFullReportLabel,
}: {
  config: WorkflowRunOutputSectionConfig;
  showFullReportLabel?: string;
}) {
  const t = useTranslations("dashboard.workflows.runDetailPage");
  const { toolbar, body } = useWorkflowRunOutputSection(config);

  return (
    <Collapsible>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            <ChevronDown />
            {showFullReportLabel ?? t("showFullReport")}
          </Button>
        </CollapsibleTrigger>
        <div className="hidden sm:block">{toolbar}</div>
      </div>
      <CollapsibleContent className="flex flex-col gap-3 pt-2">
        <div className="sm:hidden">{toolbar}</div>
        {body}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function WorkflowRunOutputPanel({
  primaryBody,
  fullReport,
  showFullReportLabel,
}: {
  primaryBody: ReactNode;
  fullReport?: WorkflowRunOutputSectionConfig;
  showFullReportLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {primaryBody}
      {fullReport ? (
        <WorkflowRunFullReportSection
          config={fullReport}
          showFullReportLabel={showFullReportLabel}
        />
      ) : null}
    </div>
  );
}
