"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DocumentFileIcon } from "@/components/knowledge-base/document-file-icon";
import { ProcessingTaskHistoryList } from "@/components/knowledge-base/processing-task-history-list";
import { api, ApiError } from "@/lib/api";
import {
  formatApiDateTime,
  parseApiDateTime,
} from "@/lib/api-datetime";
import {
  getLatestProcessingTask,
  type DocumentProcessingTask,
} from "@/lib/document-list-processing";
import { formatProgressMessage } from "@/lib/progress-message-i18n";
import { processingStatusBadgeVariant } from "@/lib/processing-task-status-ui";

export type DocumentDetail = {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  file_hash: string;
  knowledge_base_id: number;
  created_at: string;
  updated_at: string;
  chunk_count: number;
  processing_tasks: DocumentProcessingTask[];
};

type DocumentDetailDialogProps = {
  knowledgeBaseId: number;
  documentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liveTask?: DocumentProcessingTask | null;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileExtension(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) return null;
  return fileName.slice(dot + 1).toUpperCase();
}

function shortenHash(hash: string, head = 10, tail = 10): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

function MetaField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function MetaRow({
  label,
  children,
  technical,
}: {
  label: string;
  children: ReactNode;
  /** Monospace + break-all for hash and paths only; label/value typography stays the same. */
  technical?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(5.5rem,auto)_1fr] items-baseline gap-x-3 text-sm leading-snug">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          technical
            ? "min-w-0 text-right font-mono text-sm break-all"
            : "min-w-0 text-right text-sm tabular-nums"
        }
      >
        {children}
      </dd>
    </div>
  );
}

function DocumentDetailBody({
  detail,
  locale,
  dfLocale,
  t,
  formatStatus,
  effectiveTask,
  sortedTasks,
}: {
  detail: DocumentDetail;
  locale: string;
  dfLocale: typeof enUS;
  t: ReturnType<typeof useTranslations<"documentDetail">>;
  formatStatus: (raw: string) => string;
  effectiveTask: DocumentProcessingTask | null;
  sortedTasks: DocumentProcessingTask[];
}) {
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <MetaField
          label={t("chunkCount")}
          value={detail.chunk_count.toLocaleString(locale)}
        />
        <MetaField
          label={t("fileSize")}
          value={formatFileSize(detail.file_size)}
        />
        <MetaField label={t("docId")} value={`#${detail.id}`} />
      </dl>

      <Separator />

      <dl className="space-y-1.5">
        <MetaRow label={t("createdAt")}>
          <time
            dateTime={parseApiDateTime(detail.created_at).toISOString()}
            title={formatApiDateTime(
              parseApiDateTime(detail.created_at),
              locale
            )}
          >
            {formatDistanceToNow(parseApiDateTime(detail.created_at), {
              addSuffix: true,
              locale: dfLocale,
            })}
          </time>
        </MetaRow>
        <MetaRow label={t("updatedAt")}>
          <time dateTime={parseApiDateTime(detail.updated_at).toISOString()}>
            {formatApiDateTime(parseApiDateTime(detail.updated_at), locale)}
          </time>
        </MetaRow>
        <MetaRow label={t("fileHash")} technical>
          <span title={detail.file_hash}>{shortenHash(detail.file_hash)}</span>
        </MetaRow>
        <MetaRow label={t("storagePath")} technical>
          {detail.file_path}
        </MetaRow>
      </dl>

      {effectiveTask?.error_message ? (
        <>
          <Separator />
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{effectiveTask.error_message}</AlertDescription>
          </Alert>
        </>
      ) : null}

      <Separator />

      <ProcessingTaskHistoryList
        tasks={sortedTasks}
        formatStatus={formatStatus}
        taskLabel={(id) => t("taskLabel", { id })}
        emptyLabel={t("noTasks")}
      />
    </div>
  );
}

export function DocumentDetailDialog({
  knowledgeBaseId,
  documentId,
  open,
  onOpenChange,
  liveTask,
}: DocumentDetailDialogProps) {
  const t = useTranslations("documentDetail");
  const tStatus = useTranslations("processingStatus");
  const tProgress = useTranslations("processingProgress");
  const locale = useLocale();
  const dfLocale = locale === "zh" ? zhCN : enUS;

  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || documentId == null) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = (await api.get(
          `/api/knowledge-base/${knowledgeBaseId}/documents/${documentId}`
        )) as DocumentDetail;
        if (!cancelled) {
          setDetail(data);
        }
      } catch (err) {
        if (!cancelled) {
          setDetail(null);
          setError(
            err instanceof ApiError ? err.message : t("fetchError")
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, documentId, knowledgeBaseId, t]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setError(null);
    }
  }, [open]);

  const formatStatus = (raw: string) => {
    if (
      raw === "pending" ||
      raw === "processing" ||
      raw === "completed" ||
      raw === "failed"
    ) {
      return tStatus(raw);
    }
    return raw;
  };

  const effectiveTask = useMemo(() => {
    if (!detail) return liveTask ?? null;
    const latest = getLatestProcessingTask(detail.processing_tasks);
    if (liveTask && latest && liveTask.id === latest.id) {
      return { ...latest, ...liveTask };
    }
    return liveTask ?? latest;
  }, [detail, liveTask]);

  const sortedTasks = useMemo(() => {
    if (!detail?.processing_tasks?.length) return [];
    return [...detail.processing_tasks].sort((a, b) => b.id - a.id);
  }, [detail]);

  const isActiveTask =
    effectiveTask?.status === "pending" ||
    effectiveTask?.status === "processing";
  const taskProgress =
    typeof effectiveTask?.progress === "number"
      ? Math.max(0, Math.min(100, effectiveTask.progress))
      : 0;
  const progressHint =
    isActiveTask && effectiveTask
      ? effectiveTask.progress_message
        ? formatProgressMessage(effectiveTask.progress_message, tProgress)
        : taskProgress > 0
          ? `${taskProgress}%`
          : null
      : null;

  const metaLine = detail
    ? [
        fileExtension(detail.file_name),
        formatFileSize(detail.file_size),
        detail.content_type,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 gap-0 space-y-0 border-b px-6 py-5 pr-14">
          <div className="flex items-start gap-4">
            {loading && !detail ? (
              <div className="flex size-10 shrink-0 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : detail ? (
              <DocumentFileIcon
                fileName={detail.file_name}
                contentType={detail.content_type}
                size="lg"
              />
            ) : null}
            <div className="min-w-0 flex-1 space-y-1.5">
              <DialogTitle className="text-left text-base leading-snug">
                {detail?.file_name ?? t("loadingTitle")}
              </DialogTitle>
              {detail && metaLine ? (
                <DialogDescription className="text-left">
                  {metaLine}
                </DialogDescription>
              ) : null}
              {error && !detail ? (
                <DialogDescription className="text-left text-destructive">
                  {error}
                </DialogDescription>
              ) : null}
              {loading && !detail && !error ? (
                <DialogDescription className="text-left">
                  {t("loadingSubtitle")}
                </DialogDescription>
              ) : null}
              {detail && effectiveTask ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={processingStatusBadgeVariant(effectiveTask.status)}
                  >
                    {formatStatus(effectiveTask.status)}
                  </Badge>
                  {progressHint ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {progressHint}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {loading && !detail && !error ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          {detail ? (
            <DocumentDetailBody
              detail={detail}
              locale={locale}
              dfLocale={dfLocale}
              t={t}
              formatStatus={formatStatus}
              effectiveTask={effectiveTask}
              sortedTasks={sortedTasks}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
