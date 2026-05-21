"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight,
  BookSearch,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { KnowledgeBaseIcon } from "@/components/knowledge-base/knowledge-base-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface KnowledgeBaseCardItem {
  id: number;
  name: string;
  description: string | null;
  icon?: string | null;
  icon_color?: string | null;
  documents: { id: number }[];
  created_at: string;
  updated_at: string;
}

interface KnowledgeBaseCardProps {
  kb: KnowledgeBaseCardItem;
  dateLocale: string;
  testRetrievalLabel: string;
  isStartingChat: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onQuickChat: () => void;
  onUploadDocument: () => void;
}

export function KnowledgeBaseCard({
  kb,
  dateLocale,
  testRetrievalLabel,
  isStartingChat,
  onEdit,
  onDelete,
  onQuickChat,
  onUploadDocument,
}: KnowledgeBaseCardProps) {
  const t = useTranslations("knowledgePage");
  const created = new Date(kb.created_at);
  const updated = new Date(kb.updated_at);

  const createdLabel = created.toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
  });
  const updatedLabel = updated.toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
  });

  return (
    <Card size="sm" className="group relative flex h-full flex-col">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute right-3 top-3 z-10 size-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 data-[state=open]:opacity-100"
            title={t("moreActions")}
            aria-label={t("kbActionsAria", { name: kb.name })}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={8}
          className="min-w-48"
        >
          <DropdownMenuLabel className="max-w-48 truncate font-normal">
            {kb.name}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/knowledge/${kb.id}`}>
                <ArrowUpRight className="size-4" />
                {t("openKbDetail")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onUploadDocument();
              }}
            >
              <Upload className="size-4" />
              {t("addDocument")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isStartingChat}
              onSelect={(e) => {
                e.preventDefault();
                onQuickChat();
              }}
            >
              {isStartingChat ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageSquare className="size-4" />
              )}
              {t("quickChat")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onEdit();
              }}
            >
              <Pencil className="size-4" />
              {t("editKb")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/test-retrieval/${kb.id}`}>
                <BookSearch className="size-4" />
                {testRetrievalLabel}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                onDelete();
              }}
            >
              <Trash2 className="size-4" />
              {t("deleteKb")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Link href={`/dashboard/knowledge/${kb.id}`} className="flex flex-1 flex-col">
        <CardContent className="flex min-h-44 flex-1 flex-col items-start gap-4">
          <KnowledgeBaseIcon icon={kb.icon} iconColor={kb.icon_color} />
          <div className="flex w-full flex-col gap-1.5">
            <CardTitle className="line-clamp-2">{kb.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {kb.description || t("noDescription")}
            </CardDescription>
          </div>
        </CardContent>

        <CardFooter className="mt-auto flex w-full flex-col items-start gap-1 border-t">
          <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {t("cardFooterDocuments", { count: kb.documents.length })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("cardFooterDates", {
              created: createdLabel,
              updated: updatedLabel,
            })}
          </p>
        </CardFooter>
      </Link>
    </Card>
  );
}
