"use client";

import {
  type AnchorHTMLAttributes,
  type ClassAttributes,
  useMemo,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowUpRight, FileText } from "lucide-react";
import { FileIcon } from "react-file-icon";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface Citation {
  id: number;
  text: string;
  metadata: Record<string, unknown>;
}

export interface CitationInfo {
  knowledge_base: { name: string };
  document: { file_name: string; knowledge_base: { name: string } };
}

const citationChipClassName = cn(
  "chat-citation-chip",
  "mx-0.5 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center",
  "rounded-full px-1 align-baseline",
  "text-[0.6875rem] font-semibold leading-none tabular-nums",
  "bg-primary/20 text-primary",
  "ring-1 ring-inset ring-primary/40",
  "shadow-sm shadow-primary/10",
  "transition-[color,background-color,box-shadow] duration-150",
  "hover:bg-primary/30 hover:text-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
  "data-[state=open]:bg-primary/35 data-[state=open]:text-primary data-[state=open]:ring-primary/55"
);

const citationChipInvalidClassName = cn(
  "chat-citation-chip-invalid",
  "mx-0.5 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center",
  "rounded-full px-1 align-baseline",
  "text-[0.6875rem] font-medium leading-none tabular-nums",
  "bg-muted text-muted-foreground/80",
  "ring-1 ring-inset ring-border/80",
  "cursor-help"
);

function getMetadataEntries(metadata: Record<string, unknown>) {
  return Object.entries(metadata).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== "";
  });
}

function formatMetaLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function MetadataDetails({
  label,
  entries,
  className,
}: {
  label: string;
  entries: [string, unknown][];
  className?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <details
      className={cn(
        "group border-t border-border/50 px-3 pb-2.5 pt-2",
        className
      )}
    >
      <summary className="cursor-pointer list-none text-[0.6875rem] text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-1">
          <span
            className="size-1 shrink-0 rounded-full bg-muted-foreground/45 transition-transform group-open:scale-125"
            aria-hidden
          />
          {label}
        </span>
      </summary>
      <dl className="mt-2 space-y-1 rounded-lg bg-muted/25 px-2 py-1.5 font-mono text-[0.6875rem] leading-snug">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[5.25rem_1fr] gap-x-2">
            <dt className="text-muted-foreground">{formatMetaLabel(key)}</dt>
            <dd className="break-all text-foreground/75">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

interface CitationInvalidReferenceProps {
  index: number;
}

export function CitationInvalidReference({ index }: CitationInvalidReferenceProps) {
  const t = useTranslations("chatPage");

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="note"
            aria-label={t("citationInvalid", { n: index })}
            className={citationChipInvalidClassName}
          >
            {index}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {t("citationInvalidHint")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface CitationReferenceProps {
  index: number;
  citation: Citation;
  citationInfo?: CitationInfo;
  citationLoadFailed?: boolean;
  anchorProps: ClassAttributes<HTMLAnchorElement> &
    AnchorHTMLAttributes<HTMLAnchorElement>;
}

export function CitationReference({
  index,
  citation,
  citationInfo,
  citationLoadFailed = false,
  anchorProps,
}: CitationReferenceProps) {
  const t = useTranslations("chatPage");
  const extension =
    citationInfo?.document.file_name.split(".").pop()?.toLowerCase() ?? "";
  const debugMetadata = useMemo(
    () => getMetadataEntries(citation.metadata),
    [citation.metadata]
  );
  const kbId = citation.metadata.kb_id;
  const kbHref =
    typeof kbId === "number"
      ? `/dashboard/knowledge/${kbId}`
      : typeof kbId === "string" && kbId.trim() !== ""
        ? `/dashboard/knowledge/${kbId}`
        : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <a
          {...anchorProps}
          href="#"
          role="button"
          aria-label={t("citationLabel", { n: index })}
          className={cn(citationChipClassName, anchorProps.className)}
        >
          {index}
        </a>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        collisionPadding={12}
        className={cn(
          "citation-popover flex w-[min(19rem,calc(100vw-2rem))] max-h-[min(24rem,68vh)] flex-col gap-0 overflow-hidden",
          "rounded-xl border border-primary/20 bg-popover p-0 text-popover-foreground",
          "shadow-md ring-1 ring-primary/10"
        )}
      >
        <header className="shrink-0 border-b border-border/50 px-3 py-2.5">
          {citationInfo ? (
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15">
                <FileIcon
                  extension={extension}
                  color="#E2E8F0"
                  labelColor="#64748B"
                  glyphColor="#475569"
                  foldColor="#CBD5E1"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.6875rem] text-primary/80">
                  {citationInfo.knowledge_base.name}
                </p>
                <p
                  className="truncate text-[0.8125rem] font-medium leading-tight text-foreground"
                  title={citationInfo.document.file_name}
                >
                  {citationInfo.document.file_name}
                </p>
              </div>
            </div>
          ) : citationLoadFailed ? (
            <div className="flex items-center gap-2 text-[0.8125rem] text-destructive/90">
              <FileText className="size-3.5 shrink-0 opacity-60" aria-hidden />
              <span>{t("citationSourceLoadFailed")}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
              <FileText className="size-3.5 shrink-0 opacity-60" aria-hidden />
              <span>{t("citationSourceLoading")}</span>
            </div>
          )}
        </header>

        <div className="citation-popover-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <section className="px-3 py-2.5">
            <p className="mb-1.5 text-[0.625rem] font-medium tracking-wide text-primary/70">
              {t("citationExcerpt")}
            </p>
            <p className="rounded-lg border border-primary/10 bg-primary/5 px-2.5 py-2 text-[0.8125rem] leading-[1.55] text-foreground/88">
              {citation.text}
            </p>
          </section>

          <MetadataDetails
            label={t("citationDebugInfo")}
            entries={debugMetadata}
          />
        </div>

        {kbHref ? (
          <footer className="shrink-0 border-t border-border/50 p-2">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={kbHref}>
                {t("citationViewKb")}
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </footer>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
