"use client";

import { useEffect, useMemo, useState } from "react";
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
import { FileText, LayoutGrid, List, Search } from "lucide-react";
import { DocumentListSkeleton } from "@/components/skeletons/document-list-skeleton";
import { processingStatusBadgeVariant } from "@/lib/processing-task-status-ui";

const VIEW_MODE_STORAGE_KEY = "rag-web-ui:kb-documents-view";

type ViewMode = "list" | "grid";

interface Document {
  id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
  created_at: string;
  processing_tasks: Array<{
    id: number;
    status: string;
    error_message: string | null;
  }>;
}

interface DocumentListProps {
  knowledgeBaseId: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === "grid" ? "grid" : "list";
}

interface DocumentRowProps {
  doc: Document;
  formatStatus: (raw: string) => string;
  dfLocale: typeof enUS;
}

function DocumentStatusBadge({
  doc,
  formatStatus,
}: Pick<DocumentRowProps, "doc" | "formatStatus">) {
  const task = doc.processing_tasks[0];
  if (!task) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <Badge variant={processingStatusBadgeVariant(task.status)}>
      {formatStatus(task.status)}
    </Badge>
  );
}

function DocumentListTable({
  documents,
  formatStatus,
  dfLocale,
  t,
}: {
  documents: Document[];
  formatStatus: (raw: string) => string;
  dfLocale: typeof enUS;
  t: (key: string) => string;
}) {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-0 whitespace-normal">
            {t("colName")}
          </TableHead>
          <TableHead className="w-24">{t("colSize")}</TableHead>
          <TableHead className="w-36">{t("colCreated")}</TableHead>
          <TableHead className="w-28">{t("colStatus")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="max-w-0 whitespace-normal align-top">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5">
                  <DocumentFileIcon
                    fileName={doc.file_name}
                    contentType={doc.content_type}
                  />
                </div>
                <p
                  className="line-clamp-2 min-w-0 flex-1 break-words font-medium leading-snug"
                  title={doc.file_name}
                >
                  {doc.file_name}
                </p>
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {formatFileSize(doc.file_size)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground">
              {formatDistanceToNow(new Date(doc.created_at), {
                addSuffix: true,
                locale: dfLocale,
              })}
            </TableCell>
            <TableCell>
              <DocumentStatusBadge doc={doc} formatStatus={formatStatus} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DocumentGrid({
  documents,
  formatStatus,
  dfLocale,
}: {
  documents: Document[];
  formatStatus: (raw: string) => string;
  dfLocale: typeof enUS;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {documents.map((doc) => (
        <Card key={doc.id} size="sm" className="flex h-full flex-col">
          <CardContent className="flex flex-col gap-3">
            <DocumentFileIcon
              fileName={doc.file_name}
              contentType={doc.content_type}
              size="md"
            />
            <div className="flex flex-col gap-1">
              <CardTitle className="line-clamp-2" title={doc.file_name}>
                {doc.file_name}
              </CardTitle>
              <CardDescription>
                {formatFileSize(doc.file_size)}
                {" · "}
                {formatDistanceToNow(new Date(doc.created_at), {
                  addSuffix: true,
                  locale: dfLocale,
                })}
              </CardDescription>
            </div>
          </CardContent>
          <CardFooter className="border-t">
            <DocumentStatusBadge doc={doc} formatStatus={formatStatus} />
          </CardFooter>
        </Card>
      ))}
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

  useEffect(() => {
    setViewMode(readStoredViewMode());
  }, []);

  const handleViewModeChange = (next: string) => {
    if (next !== "list" && next !== "grid") return;
    setViewMode(next);
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
  };

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((doc) =>
      doc.file_name.toLowerCase().includes(query)
    );
  }, [documents, searchTerm]);

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
      <div className="flex justify-center p-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold">{t("emptyTitle")}</h3>
        <p className="mt-2 max-w-md text-muted-foreground">{t("emptySubtitle")}</p>
      </div>
    );
  }

  const showNoSearchResults =
    searchTerm.trim() !== "" && filteredDocuments.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
        />
      ) : (
        <DocumentListTable
          documents={filteredDocuments}
          formatStatus={formatStatus}
          dfLocale={dfLocale}
          t={t}
        />
      )}
    </div>
  );
}
