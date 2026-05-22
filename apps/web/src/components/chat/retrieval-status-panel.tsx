"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Circle, FileText, Loader2, Minus } from "lucide-react";
import {
  retrievalDocumentKey,
  type RetrievalStreamState,
} from "@/lib/chat-retrieval-stream";
import {
  buildRetrievalSteps,
  formatKbNames,
  type RetrievalStepStatus,
  type RetrievalStepView,
} from "@/lib/retrieval-steps";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_SOURCES = 12;

interface RetrievalStatusPanelProps {
  retrievalStream: RetrievalStreamState;
  isStreaming: boolean;
  answerStarted: boolean;
  answerFinished: boolean;
  linkedKbNamesLabel: string | null;
}

function StepIcon({ status }: { status: RetrievalStepStatus }) {
  if (status === "active") {
    return (
      <Loader2
        className="size-3.5 shrink-0 animate-spin text-foreground/70"
        aria-hidden
      />
    );
  }
  if (status === "done") {
    return (
      <Check
        className="size-3.5 shrink-0 text-foreground/55"
        strokeWidth={2}
        aria-hidden
      />
    );
  }
  if (status === "skipped") {
    return (
      <Minus
        className="size-3.5 shrink-0 text-muted-foreground/45"
        strokeWidth={2}
        aria-hidden
      />
    );
  }
  return (
    <Circle
      className="size-3.5 shrink-0 text-muted-foreground/35"
      strokeWidth={1.5}
      aria-hidden
    />
  );
}

function SourceList({
  documents,
  documentCount,
  isStreaming,
  t,
}: {
  documents: RetrievalStreamState["documents"];
  documentCount: number;
  isStreaming: boolean;
  t: ReturnType<typeof useTranslations<"chatPage">>;
}) {
  const visibleDocs = documents.slice(0, MAX_VISIBLE_SOURCES);
  const overflowCount = Math.max(0, documentCount - MAX_VISIBLE_SOURCES);

  return (
    <ul
      className="flex min-w-0 flex-col gap-px border-l border-border/30 pl-3 pt-1"
      role="list"
    >
      {visibleDocs.map((doc, index) => (
        <li
          key={`${retrievalDocumentKey(doc)}-${index}`}
          className={cn(
            "flex min-w-0 items-center gap-2 py-0.5",
            isStreaming && "retrieval-source-enter"
          )}
        >
          <FileText
            className="size-3 shrink-0 text-muted-foreground/45"
            strokeWidth={1.75}
            aria-hidden
          />
          <span
            className="min-w-0 truncate text-[0.8125rem] leading-snug text-foreground/65"
            title={doc.preview || doc.file_name}
          >
            {doc.file_name || t("retrievalUnknownDocument")}
          </span>
        </li>
      ))}
      {overflowCount > 0 ? (
        <li className="flex min-w-0 items-center gap-2 py-0.5 pl-5 text-[0.75rem] text-muted-foreground/55">
          {t("retrievalMoreSources", { count: overflowCount })}
        </li>
      ) : null}
    </ul>
  );
}

function stepLabel(
  step: RetrievalStepView,
  stream: RetrievalStreamState,
  t: ReturnType<typeof useTranslations<"chatPage">>,
  linkedKbNamesLabel: string | null,
  locale: string
): string {
  const kbNames =
    formatKbNames(
      stream.knowledgeBases,
      3,
      locale.startsWith("zh") ? "、" : ", "
    ) ||
    linkedKbNamesLabel ||
    "";
  const recalled = stream.recalledCount ?? stream.documents.length;
  const selected =
    stream.selectedCount ?? stream.count ?? stream.documents.length;
  const pruned = Math.max(0, recalled - selected);
  const searchQuery =
    stream.searchQuery?.trim() || stream.query?.trim() || "";

  if (step.status === "skipped") {
    if (step.id === "rewrite") return t("retrievalStep_rewrite_skipped");
    return t(`retrievalStep_${step.id}_title`);
  }

  if (step.status === "active") {
    switch (step.id) {
      case "rewrite":
        return t("retrievalStep_rewrite_active");
      case "search":
        return kbNames
          ? t("retrievalStep_search_active", { names: kbNames })
          : t("retrievalStep_search_title");
      case "recall":
        return stream.documents.length > 0
          ? t("retrievalStep_recall_active", {
              count: stream.documents.length,
            })
          : t("retrievalStep_recall_title");
      case "rank":
        return t("retrievalStep_rank_active");
      case "generate":
        return selected > 0
          ? t("generatingWithSources", { count: selected })
          : t("retrievalStep_generate_active");
      default:
        return "";
    }
  }

  if (step.status === "done") {
    switch (step.id) {
      case "rewrite":
        if (
          stream.searchQuery &&
          stream.query &&
          stream.searchQuery.trim() !== stream.query.trim()
        ) {
          return t("retrievalStep_rewrite_done");
        }
        return t("retrievalStep_rewrite_skipped");
      case "search":
        return kbNames
          ? t("retrievalStep_search_done", { names: kbNames })
          : t("retrievalStep_search_title");
      case "recall":
        return t("retrievalStep_recall_done", { count: recalled });
      case "rank":
        if (selected === 0) {
          return t("retrievalStep_rank_doneEmpty");
        }
        if (pruned > 0) {
          return t("retrievalStep_rank_done", { selected, recalled, pruned });
        }
        return t("retrievalStep_rank_doneSimple", { selected });
      case "generate":
        return selected > 0
          ? t("retrievalSourcesUsed", { count: selected })
          : t("retrievalStep_generate_done");
      default:
        return "";
    }
  }

  return t(`retrievalStep_${step.id}_title`);
}

function stepDetail(
  step: RetrievalStepView,
  stream: RetrievalStreamState,
  t: ReturnType<typeof useTranslations<"chatPage">>
): string | null {
  if (step.status !== "done" && step.status !== "active") return null;

  const searchQuery =
    stream.searchQuery?.trim() || stream.query?.trim() || "";

  if (step.id === "rewrite" && step.status === "done") {
    if (
      stream.searchQuery &&
      stream.query &&
      stream.searchQuery.trim() !== stream.query.trim()
    ) {
      return searchQuery;
    }
    return null;
  }

  if (step.id === "search" && searchQuery) {
    return `${t("retrievalSearchQuery")} ${searchQuery}`;
  }

  return null;
}

export function RetrievalStatusPanel({
  retrievalStream,
  isStreaming,
  answerStarted,
  answerFinished,
  linkedKbNamesLabel,
}: RetrievalStatusPanelProps) {
  const t = useTranslations("chatPage");
  const locale = useLocale();

  const documents = retrievalStream.documents;
  const documentCount = documents.length;
  const canCollapse = documentCount > 0;

  const steps = useMemo(
    () =>
      buildRetrievalSteps(retrievalStream, {
        isStreaming,
        answerStarted,
        answerFinished,
      }),
    [retrievalStream, isStreaming, answerStarted, answerFinished]
  );

  const [sourcesOpen, setSourcesOpen] = useState(isStreaming);

  useEffect(() => {
    if (isStreaming) {
      setSourcesOpen(true);
    } else if (documentCount > 0) {
      setSourcesOpen(false);
    }
  }, [isStreaming, documentCount]);

  const showSteps = steps.some((s) => s.status !== "pending");

  if (!isStreaming && documentCount === 0 && !showSteps) {
    return null;
  }
  if (isStreaming && retrievalStream.phase == null && !answerStarted) {
    return null;
  }

  const stepsBlock = (
    <ol className="flex min-w-0 flex-col gap-1" aria-label={t("retrievalPipelineAria")}>
      {steps.map((step) => {
        const label = stepLabel(
          step,
          retrievalStream,
          t,
          linkedKbNamesLabel,
          locale
        );
        const detail = stepDetail(step, retrievalStream, t);
        const isGenerate = step.id === "generate";

        return (
          <li
            key={step.id}
            className={cn(
              "flex min-w-0 gap-2",
              step.status === "pending" && "opacity-45"
            )}
          >
            <StepIcon status={step.status} />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-xs leading-snug",
                  step.status === "active"
                    ? "text-foreground/85"
                    : "text-muted-foreground/80",
                  isGenerate &&
                    step.status === "active" &&
                    "retrieval-status-text--generating"
                )}
              >
                {label}
              </p>
              {detail ? (
                <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground/65">
                  {detail}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );

  if (!canCollapse) {
    return (
      <div
        className="flex w-full min-w-0 flex-col gap-2 py-0.5 text-muted-foreground"
        aria-live="polite"
        aria-busy={isStreaming && !answerStarted}
      >
        {stepsBlock}
      </div>
    );
  }

  const selected =
    retrievalStream.selectedCount ??
    retrievalStream.count ??
    documentCount;

  return (
    <div
      className="w-full min-w-0 py-0.5 text-muted-foreground"
      aria-live="polite"
      aria-busy={isStreaming && !answerStarted}
    >
      <div className="mb-1.5">{stepsBlock}</div>
      <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
        <CollapsibleTrigger
          aria-label={t("retrievalSourcesToggleAria")}
          className="group flex w-full min-w-0 items-center gap-2 rounded-md py-0.5 text-left transition-colors hover:text-foreground/90"
        >
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/80">
            {t("retrievalStep_rank_fragments", { count: selected })}
          </span>
          <ChevronDown
            className="size-3.5 shrink-0 text-muted-foreground/55 transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-1">
          <SourceList
            documents={documents}
            documentCount={documentCount}
            isStreaming={isStreaming}
            t={t}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
