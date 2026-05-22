"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { api, ApiError } from "@/lib/api";
import {
  formatApiDateTime,
  parseApiDateTime,
} from "@/lib/api-datetime";
import { DocumentFileIcon } from "@/components/knowledge-base/document-file-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
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
import {
  FileText,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { DocumentDetailDialog } from "@/components/knowledge-base/document-detail-dialog";
import { DocumentListSkeleton } from "@/components/skeletons/document-list-skeleton";
import { processingStatusBadgeVariant } from "@/lib/processing-task-status-ui";
import { runProcessingPoll } from "@/lib/document-processing-poll";
import {
  getLatestProcessingTask,
  isDocumentProcessingFromTask,
  type DocumentProcessingTask,
} from "@/lib/document-list-processing";
import { formatProgressMessage } from "@/lib/progress-message-i18n";
import { cn } from "@/lib/utils";

const VIEW_MODE_STORAGE_KEY = "rag-web-ui:kb-documents-view";

type ViewMode = "list" | "grid";

interface Document {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  created_at: string;
  processing_tasks: DocumentProcessingTask[];
}

interface DocumentListProps {
  knowledgeBaseId: number;
}

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

function readStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === "grid" ? "grid" : "list";
}

function resolveDocumentTask(
  doc: Document,
  liveTask?: DocumentProcessingTask | null
): DocumentProcessingTask | null {
  return liveTask ?? getLatestProcessingTask(doc.processing_tasks);
}

function isDocumentProcessing(
  doc: Document,
  liveTask?: DocumentProcessingTask | null
): boolean {
  return isDocumentProcessingFromTask(resolveDocumentTask(doc, liveTask));
}

function sortDocumentsByCreated(documents: Document[]): Document[] {
  return [...documents].sort(
    (a, b) =>
      parseApiDateTime(b.created_at).getTime() -
      parseApiDateTime(a.created_at).getTime()
  );
}

interface DocumentRowProps {
  doc: Document;
  formatStatus: (raw: string) => string;
  dfLocale: typeof enUS;
  locale: string;
  liveTask?: DocumentProcessingTask | null;
}

function getDocumentCreatedLabel(
  createdAt: string,
  dfLocale: typeof enUS,
  locale: string
) {
  const created = parseApiDateTime(createdAt);
  const relative = formatDistanceToNow(created, {
    addSuffix: true,
    locale: dfLocale,
  });
  const absolute = formatApiDateTime(created, locale);
  return { relative, absolute };
}

function DocumentStatusBadge({
  doc,
  formatStatus,
  liveTask,
}: Pick<DocumentRowProps, "doc" | "formatStatus" | "liveTask">) {
  const tProgress = useTranslations("processingProgress");
  const task = resolveDocumentTask(doc, liveTask);
  if (!task) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const showProgress =
    (task.status === "pending" || task.status === "processing") &&
    typeof task.progress === "number" &&
    task.progress > 0;
  const progressLabel = showProgress
    ? task.progress_message
      ? formatProgressMessage(task.progress_message, tProgress)
      : `${task.progress}%`
    : formatStatus(task.status);
  return (
    <Badge variant={processingStatusBadgeVariant(task.status)}>
      {progressLabel}
    </Badge>
  );
}

function DocumentCreatedCell({
  createdAt,
  dfLocale,
  locale,
}: {
  createdAt: string;
  dfLocale: typeof enUS;
  locale: string;
}) {
  const { relative, absolute } = getDocumentCreatedLabel(
    createdAt,
    dfLocale,
    locale
  );
  return (
    <time
      dateTime={parseApiDateTime(createdAt).toISOString()}
      title={absolute}
      className="cursor-default text-muted-foreground"
    >
      {relative}
    </time>
  );
}

function DocumentActionsMenu({
  doc,
  t,
  deletingId,
  reprocessingId,
  liveTask,
  onRequestReprocess,
  onRequestDelete,
  triggerClassName,
}: {
  doc: Document;
  t: (key: string, values?: Record<string, string>) => string;
  deletingId: number | null;
  reprocessingId: number | null;
  liveTask?: DocumentProcessingTask | null;
  onRequestReprocess: (doc: Document) => void;
  onRequestDelete: (doc: Document) => void;
  triggerClassName?: string;
}) {
  const processing = isDocumentProcessing(doc, liveTask);
  const isDeleting = deletingId === doc.id;
  const isReprocessing = reprocessingId === doc.id;
  const busy = isDeleting || isReprocessing;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "text-muted-foreground hover:text-foreground",
            triggerClassName
          )}
          disabled={busy}
          title={t("moreActions")}
          aria-label={t("actionsAria", { name: doc.file_name })}
          onPointerDown={(e: PointerEvent<HTMLButtonElement>) =>
            e.stopPropagation()
          }
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-44">
        <DropdownMenuLabel className="max-w-52 truncate font-normal">
          {doc.file_name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={processing}
            onSelect={(e: Event) => {
              e.preventDefault();
              onRequestReprocess(doc);
            }}
          >
            <RefreshCw className="size-4" />
            {processing ? t("reprocessProcessing") : t("reprocess")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            disabled={processing}
            onSelect={(e: Event) => {
              e.preventDefault();
              onRequestDelete(doc);
            }}
          >
            <Trash2 className="size-4" />
            {processing ? t("deleteProcessing") : t("delete")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DocumentListTable({
  documents,
  formatStatus,
  dfLocale,
  locale,
  t,
  deletingId,
  reprocessingId,
  liveTasksByDocId,
  onOpenDetail,
  onRequestDelete,
  onRequestReprocess,
}: {
  documents: Document[];
  formatStatus: (raw: string) => string;
  dfLocale: typeof enUS;
  locale: string;
  t: (key: string, values?: Record<string, string>) => string;
  deletingId: number | null;
  reprocessingId: number | null;
  liveTasksByDocId: Record<number, DocumentProcessingTask>;
  onOpenDetail: (doc: Document) => void;
  onRequestDelete: (doc: Document) => void;
  onRequestReprocess: (doc: Document) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
            <TableHead className="h-11 min-w-0 px-4 font-medium">
              {t("colName")}
            </TableHead>
            <TableHead className="h-11 w-28 px-4 font-medium">
              {t("colSize")}
            </TableHead>
            <TableHead className="h-11 w-40 px-4 font-medium">
              {t("colCreated")}
            </TableHead>
            <TableHead className="h-11 w-32 px-4 font-medium">
              {t("colStatus")}
            </TableHead>
            <TableHead className="h-11 w-14 px-2 text-right font-medium">
              <span className="sr-only">{t("colActions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const ext = fileExtension(doc.file_name);
            const liveTask = liveTasksByDocId[doc.id];
            return (
              <TableRow
                key={doc.id}
                className="group cursor-pointer"
                onClick={() => onOpenDetail(doc)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenDetail(doc);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={doc.file_name}
              >
                <TableCell className="max-w-0 px-4 py-3 align-middle">
                  <div className="flex min-w-0 items-center gap-3">
                    <DocumentFileIcon
                      fileName={doc.file_name}
                      contentType={doc.content_type}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate font-medium leading-snug"
                        title={doc.file_name}
                      >
                        {doc.file_name}
                      </p>
                      {ext ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ext}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 align-middle tabular-nums text-muted-foreground">
                  {formatFileSize(doc.file_size)}
                </TableCell>
                <TableCell className="px-4 py-3 align-middle text-sm">
                  <DocumentCreatedCell
                    createdAt={doc.created_at}
                    dfLocale={dfLocale}
                    locale={locale}
                  />
                </TableCell>
                <TableCell className="px-4 py-3 align-middle">
                  <DocumentStatusBadge
                    doc={doc}
                    formatStatus={formatStatus}
                    liveTask={liveTask}
                  />
                </TableCell>
                <TableCell
                  className="px-2 py-3 text-right align-middle"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <DocumentActionsMenu
                    doc={doc}
                    t={t}
                    deletingId={deletingId}
                    reprocessingId={reprocessingId}
                    liveTask={liveTask}
                    onRequestReprocess={onRequestReprocess}
                    onRequestDelete={onRequestDelete}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function DocumentGrid({
  documents,
  formatStatus,
  dfLocale,
  locale,
  t,
  deletingId,
  reprocessingId,
  liveTasksByDocId,
  onOpenDetail,
  onRequestDelete,
  onRequestReprocess,
}: {
  documents: Document[];
  formatStatus: (raw: string) => string;
  dfLocale: typeof enUS;
  locale: string;
  t: (key: string, values?: Record<string, string>) => string;
  deletingId: number | null;
  reprocessingId: number | null;
  liveTasksByDocId: Record<number, DocumentProcessingTask>;
  onOpenDetail: (doc: Document) => void;
  onRequestDelete: (doc: Document) => void;
  onRequestReprocess: (doc: Document) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {documents.map((doc) => {
        const liveTask = liveTasksByDocId[doc.id];
        const { relative, absolute } = getDocumentCreatedLabel(
          doc.created_at,
          dfLocale,
          locale
        );
        const ext = fileExtension(doc.file_name);
        return (
          <Card
            key={doc.id}
            size="sm"
            role="button"
            tabIndex={0}
            className="group relative flex h-full cursor-pointer flex-col transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onOpenDetail(doc)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDetail(doc);
              }
            }}
            aria-label={doc.file_name}
          >
            <div
              className="absolute right-2 top-2 z-10"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <DocumentActionsMenu
                doc={doc}
                t={t}
                deletingId={deletingId}
                reprocessingId={reprocessingId}
                liveTask={liveTask}
                onRequestReprocess={onRequestReprocess}
                onRequestDelete={onRequestDelete}
                triggerClassName="size-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 data-[state=open]:opacity-100"
              />
            </div>
            <CardContent className="flex flex-col gap-3">
              <DocumentFileIcon
                fileName={doc.file_name}
                contentType={doc.content_type}
                size="md"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle className="line-clamp-2 text-base" title={doc.file_name}>
                  {doc.file_name}
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {ext ? (
                    <>
                      <span>{ext}</span>
                      <span aria-hidden>·</span>
                    </>
                  ) : null}
                  <span className="tabular-nums">
                    {formatFileSize(doc.file_size)}
                  </span>
                  <span aria-hidden>·</span>
                  <time
                    dateTime={parseApiDateTime(doc.created_at).toISOString()}
                    title={absolute}
                    className="cursor-default"
                  >
                    {relative}
                  </time>
                </CardDescription>
              </div>
            </CardContent>
            <CardFooter className="mt-auto border-t bg-muted/20">
              <DocumentStatusBadge
                doc={doc}
                formatStatus={formatStatus}
                liveTask={liveTask}
              />
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

export function DocumentList({ knowledgeBaseId }: DocumentListProps) {
  const t = useTranslations("documentList");
  const tStatus = useTranslations("processingStatus");
  const locale = useLocale();
  const dfLocale = locale === "zh" ? zhCN : enUS;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [reprocessTarget, setReprocessTarget] = useState<Document | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);
  const [liveTasksByDocId, setLiveTasksByDocId] = useState<
    Record<number, DocumentProcessingTask>
  >({});
  const [detailDocId, setDetailDocId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const pollAbortRef = useRef(false);

  const openDocumentDetail = (doc: Document) => {
    setDetailDocId(doc.id);
    setDetailOpen(true);
  };

  useEffect(() => {
    setViewMode(readStoredViewMode());
  }, []);

  useEffect(() => {
    pollAbortRef.current = false;
    return () => {
      pollAbortRef.current = true;
    };
  }, []);

  const handleViewModeChange = (next: string) => {
    if (next !== "list" && next !== "grid") return;
    setViewMode(next);
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
  };

  const sortedDocuments = useMemo(
    () => sortDocumentsByCreated(documents),
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sortedDocuments;
    return sortedDocuments.filter((doc) =>
      doc.file_name.toLowerCase().includes(query)
    );
  }, [sortedDocuments, searchTerm]);

  const mergeTaskIntoDocument = (
    docId: number,
    taskId: number,
    patch: Partial<DocumentProcessingTask>
  ) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const tasks = [...d.processing_tasks];
        const idx = tasks.findIndex((t) => t.id === taskId);
        const base: DocumentProcessingTask =
          idx >= 0
            ? { ...tasks[idx], ...patch }
            : {
                id: taskId,
                status: patch.status ?? "pending",
                progress: patch.progress ?? 0,
                progress_message: patch.progress_message ?? null,
                error_message: patch.error_message ?? null,
              };
        if (idx >= 0) {
          tasks[idx] = base;
        } else {
          tasks.unshift(base);
        }
        return { ...d, processing_tasks: tasks };
      })
    );
  };

  const startTaskPoll = (docId: number, taskId: number) => {
    runProcessingPoll({
      knowledgeBaseId,
      taskIds: [taskId],
      uploadIdByTaskId: new Map([[taskId, 0]]),
      shouldAbort: () => pollAbortRef.current,
      onUpdate: (statuses) => {
        const polled = statuses[taskId];
        if (!polled) return;
        const live: DocumentProcessingTask = {
          id: taskId,
          status: polled.status,
          progress: polled.progress,
          progress_message: polled.progress_message ?? null,
          error_message: polled.error_message ?? null,
        };
        setLiveTasksByDocId((prev) => ({ ...prev, [docId]: live }));
        mergeTaskIntoDocument(docId, taskId, live);
      },
      onDone: ({ allSucceeded, failedTasks }) => {
        setLiveTasksByDocId((prev) => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
        if (allSucceeded) {
          toast.success(t("reprocessSuccess"));
        } else {
          const message =
            failedTasks[0]?.error_message?.trim() || t("reprocessError");
          toast.error(message);
        }
      },
      onError: () => {
        setLiveTasksByDocId((prev) => {
          const next = { ...prev };
          delete next[docId];
          return next;
        });
        toast.error(t("reprocessError"));
      },
    });
  };

  const handleConfirmReprocess = async () => {
    if (!reprocessTarget) return;
    const doc = reprocessTarget;
    setReprocessingId(doc.id);
    try {
      const result = (await api.post(
        `/api/knowledge-base/${knowledgeBaseId}/documents/${doc.id}/reprocess`
      )) as { task_id: number; document_id: number };
      mergeTaskIntoDocument(doc.id, result.task_id, {
        status: "pending",
        progress: 0,
        progress_message: null,
        error_message: null,
      });
      startTaskPoll(doc.id, result.task_id);
      toast.success(t("reprocessStarted"));
      setReprocessTarget(null);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(t("reprocessError"));
      }
    } finally {
      setReprocessingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await api.delete(
        `/api/knowledge-base/${knowledgeBaseId}/documents/${deleteTarget.id}`
      );
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast.success(t("deleteSuccess"));
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(t("deleteError"));
      }
    } finally {
      setDeletingId(null);
    }
  };

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

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const data = await api.get(`/api/knowledge-base/${knowledgeBaseId}`);
        setDocuments(data.documents);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("fetchError"));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [knowledgeBaseId, t]);

  if (loading) {
    return <DocumentListSkeleton />;
  }

  if (error) {
    return (
      <div className="flex justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{t("emptyTitle")}</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t("emptySubtitle")}
        </p>
      </div>
    );
  }

  const showNoSearchResults =
    searchTerm.trim() !== "" && filteredDocuments.length === 0;

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <InputGroup className="min-w-0 flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
          <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {t("documentCount", { count: documents.length })}
          </p>
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={viewMode}
          onValueChange={handleViewModeChange}
          aria-label={t("viewModeAria")}
          className="shrink-0 self-end sm:self-auto"
        >
          <ToggleGroupItem value="list" aria-label={t("viewList")}>
            <List />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label={t("viewGrid")}>
            <LayoutGrid />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {showNoSearchResults ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("searchNoResults")}
        </p>
      ) : viewMode === "grid" ? (
        <DocumentGrid
          documents={filteredDocuments}
          formatStatus={formatStatus}
          dfLocale={dfLocale}
          locale={locale}
          t={t}
          deletingId={deletingId}
          reprocessingId={reprocessingId}
          liveTasksByDocId={liveTasksByDocId}
          onOpenDetail={openDocumentDetail}
          onRequestDelete={setDeleteTarget}
          onRequestReprocess={setReprocessTarget}
        />
      ) : (
        <DocumentListTable
          documents={filteredDocuments}
          formatStatus={formatStatus}
          dfLocale={dfLocale}
          locale={locale}
          t={t}
          deletingId={deletingId}
          reprocessingId={reprocessingId}
          liveTasksByDocId={liveTasksByDocId}
          onOpenDetail={openDocumentDetail}
          onRequestDelete={setDeleteTarget}
          onRequestReprocess={setReprocessTarget}
        />
      )}
    </div>

    <DocumentDetailDialog
      knowledgeBaseId={knowledgeBaseId}
      documentId={detailDocId}
      open={detailOpen}
      onOpenChange={(open) => {
        setDetailOpen(open);
        if (!open) setDetailDocId(null);
      }}
      liveTask={
        detailDocId != null ? liveTasksByDocId[detailDocId] : undefined
      }
    />

    <AlertDialog
      open={reprocessTarget !== null}
      onOpenChange={(open) => !open && setReprocessTarget(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("reprocessTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {reprocessTarget
              ? t("reprocessDescription", { name: reprocessTarget.file_name })
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            size="default"
            variant="outline"
            disabled={reprocessingId !== null}
          >
            {t("reprocessCancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            size="default"
            variant="default"
            disabled={reprocessingId !== null}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirmReprocess();
            }}
          >
            {reprocessingId !== null ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {t("reprocessConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={deleteTarget !== null}
      onOpenChange={(open) => !open && setDeleteTarget(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget
              ? t("deleteDescription", { name: deleteTarget.file_name })
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            size="default"
            variant="outline"
            disabled={deletingId !== null}
          >
            {t("deleteCancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            size="default"
            variant="destructive"
            disabled={deletingId !== null}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirmDelete();
            }}
          >
            {deletingId !== null ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {t("deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
