"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MessageSquarePlus, Search, Trash2 } from "lucide-react";
import { useChatHistory } from "@/components/chat/chat-history-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChatSummary } from "@/lib/chat-list";

function formatChatTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function ChatHistoryItem({
  chat,
  isActive,
  locale,
  onSelect,
  onDelete,
  t,
}: {
  chat: ChatSummary;
  isActive: boolean;
  locale: string;
  onSelect: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations<"chatPage">>;
}) {
  const preview =
    chat.last_message_preview?.trim() || t("historyEmptyPreview");
  const timeLabel = formatChatTime(chat.last_message_at ?? chat.updated_at, locale);

  return (
    <div
      className={cn(
        "group relative flex w-full min-w-0 rounded-lg transition-colors",
        isActive ? "bg-accent" : "hover:bg-muted/60"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5 pr-9 text-left",
          isActive && "text-accent-foreground"
        )}
      >
        <span className="truncate text-sm font-medium leading-snug">
          {chat.title || t("untitledChat")}
        </span>
        <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
          {preview}
        </span>
        <span className="text-[0.6875rem] text-muted-foreground/80">
          {timeLabel}
          {chat.message_count > 0
            ? ` · ${t("messagesMeta", { count: chat.message_count })}`
            : null}
        </span>
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-1 top-1.5 size-7 shrink-0 opacity-0 transition-opacity",
              "group-hover:opacity-100 focus-visible:opacity-100",
              isActive && "opacity-100"
            )}
            aria-label={t("deleteChatAria")}
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteChatTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onDelete()}
            >
              {t("deleteChatConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-1.5 rounded-lg px-3 py-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ChatHistorySidebar() {
  const t = useTranslations("chatPage");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const {
    chats,
    activeChatId,
    isLoading,
    isCreating,
    selectChat,
    createNewChat,
    removeChat,
  } = useChatHistory();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((chat) => {
      const haystack = [
        chat.title,
        chat.last_message_preview ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [chats, query]);

  return (
    <aside
      className="flex h-full w-70 shrink-0 flex-col border-r border-border bg-muted/20"
      aria-label={t("listTitle")}
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold">{t("listTitle")}</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1 px-2"
            disabled={isCreating}
            onClick={() => void createNewChat()}
          >
            <MessageSquarePlus className="size-3.5" />
            <span className="sr-only sm:not-sr-only sm:inline">
              {t("startNewChat")}
            </span>
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 pl-8 text-xs"
            aria-label={t("searchPlaceholder")}
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <SidebarSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            {query.trim() ? t("searchNoResults") : t("emptyTitle")}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {filtered.map((chat) => (
              <ChatHistoryItem
                key={chat.id}
                chat={chat}
                isActive={activeChatId === chat.id}
                locale={locale}
                onSelect={() => selectChat(chat.id)}
                onDelete={() => void removeChat(chat.id)}
                t={t}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
