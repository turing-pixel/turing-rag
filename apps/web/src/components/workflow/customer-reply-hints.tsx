"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CustomerReplyHintsProps {
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function CustomerReplyHints({
  collapsible = false,
  defaultOpen = true,
  className,
}: CustomerReplyHintsProps) {
  const t = useTranslations("dashboard.workflows");
  const tHints = useTranslations("dashboard.workflows.customerReply");

  const body = (
    <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
      <p>{tHints("hintsKb")}</p>
      <p>{tHints("hintsInput")}</p>
      <p>{tHints("hintsOutput")}</p>
    </div>
  );

  if (!collapsible) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border/80 bg-muted/20 p-4",
          className
        )}
      >
        <p className="mb-2 text-sm font-medium">{tHints("hintsTitle")}</p>
        {body}
      </div>
    );
  }

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn(
        "rounded-lg border border-dashed border-border/80 bg-muted/20",
        className
      )}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30 [&[data-state=open]>svg]:rotate-180">
        {t("testPanel.hintsToggle")}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-3">
        {body}
      </CollapsibleContent>
    </Collapsible>
  );
}
