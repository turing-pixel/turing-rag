"use client";

import { useTranslations } from "next-intl";
import {
  ArrowDownUp,
  ArrowRightLeft,
  GripVertical,
  LayoutTemplate,
  Loader2,
  Scan,
} from "lucide-react";
import { Panel } from "@xyflow/react";

import type { LayoutDirection } from "@/components/rag/rag-auto-layout";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RagFlowToolbarProps = {
  isLayouting: boolean;
  onAutoLayout: (direction: LayoutDirection) => void;
  onResetLayout: () => void;
  onFitView: () => void;
};

function ToolbarIconButton({
  label,
  onClick,
  disabled,
  isLoading,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className={cn("size-8 shrink-0", className)}
          aria-label={label}
          disabled={disabled || isLoading}
          onClick={onClick}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            children
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function RagFlowToolbar({
  isLayouting,
  onAutoLayout,
  onResetLayout,
  onFitView,
}: RagFlowToolbarProps) {
  const t = useTranslations("dashboard.rag.toolbar");

  return (
    <Panel position="top-right" className="m-0!">
        <div
          className="flex items-center gap-0.5 rounded-lg border border-border bg-card/95 p-1 shadow-md backdrop-blur-sm"
          role="toolbar"
          aria-label={t("aria")}
        >
          <ToolbarIconButton
            label={t("autoLayoutVertical")}
            onClick={() => onAutoLayout("TB")}
            disabled={isLayouting}
            isLoading={isLayouting}
          >
            <ArrowDownUp className="size-4" aria-hidden />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={t("autoLayoutHorizontal")}
            onClick={() => onAutoLayout("LR")}
            disabled={isLayouting}
          >
            <ArrowRightLeft className="size-4" aria-hidden />
          </ToolbarIconButton>

          <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

          <ToolbarIconButton
            label={t("resetLayout")}
            onClick={onResetLayout}
            disabled={isLayouting}
          >
            <LayoutTemplate className="size-4" aria-hidden />
          </ToolbarIconButton>

          <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

          <ToolbarIconButton label={t("fitView")} onClick={onFitView}>
            <Scan className="size-4" aria-hidden />
          </ToolbarIconButton>

          <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />

          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="flex size-8 items-center justify-center text-muted-foreground"
                tabIndex={0}
                aria-label={t("dragHint")}
              >
                <GripVertical className="size-3.5 opacity-60" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-[220px] text-xs leading-relaxed"
            >
              {t("dragHint")}
            </TooltipContent>
          </Tooltip>
        </div>
    </Panel>
  );
}
