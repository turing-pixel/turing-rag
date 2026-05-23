"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  MessageSquarePlus,
  PanelLeft,
  PanelLeftClose,
  Search,
  Trash2,
} from "lucide-react";
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
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

function chatListLabel(chat: ChatSummary, t: ReturnType<typeof useTranslations<"chatPage">>) {
  const title = chat.title?.trim();
  if (title) return title;
  const preview = chat.last_message_preview?.trim();
  if (preview) return preview;
  return t("untitledChat");
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
  const label = chatListLabel(chat, t);
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
          "flex min-w-0 flex-1 items-center gap-2 ps-3 pe-9 py-2 text-left",
          isActive && "text-accent-foreground"
        )}
      >
        <span className="min-w-0 flex-1 truncate text-sm leading-snug">
          {label}
        </span>
        {timeLabel ? (
          <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
            {timeLabel}
          </span>
        ) : null}
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-1 top-1/2 size-7 shrink-0 -translate-y-1/2 opacity-0 transition-opacity",
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
    <div className="flex flex-col gap-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg ps-3 pe-3 py-2">
          <Skeleton className="h-4 min-w-0 flex-1" />
          <Skeleton className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

interface SidebarHeaderActionsProps {
  isLoading: boolean;
  isCreating: boolean;
  onSearchOpen: () => void;
  onCreateChat: () => void;
  t: ReturnType<typeof useTranslations<"chatPage">>;
  collapsed?: boolean;
}

interface SidebarFooterToggleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: ReturnType<typeof useTranslations<"chatPage">>;
  collapsed?: boolean;
}

const sidebarIconButtonClass = "size-8 shrink-0 text-muted-foreground";

function SidebarIconButton({
  label,
  onClick,
  disabled,
  children,
  tooltipSide = "right",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={sidebarIconButtonClass}
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarFooterToggle({
  open,
  onOpenChange,
  t,
  collapsed = false,
}: SidebarFooterToggleProps) {
  const toggleLabel = open ? t("historySidebarCollapse") : t("historySidebarExpand");

  return (
    <footer
      className={cn(
        "mt-auto flex shrink-0 border-t border-border",
        collapsed ? "justify-center py-2" : "px-2 py-2"
      )}
    >
      <SidebarIconButton
        label={toggleLabel}
        onClick={() => onOpenChange(!open)}
        tooltipSide={collapsed ? "right" : "top"}
      >
        {open ? <PanelLeftClose className="size-4" /> : <PanelLeft className="size-4" />}
      </SidebarIconButton>
    </footer>
  );
}

function SidebarHeaderActions({
  isLoading,
  isCreating,
  onSearchOpen,
  onCreateChat,
  t,
  collapsed = false,
}: SidebarHeaderActionsProps) {
  const newChatButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 shrink-0 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
      disabled={isCreating}
      aria-label={t("startNewChat")}
      onClick={onCreateChat}
    >
      <MessageSquarePlus className="size-4 shrink-0" />
      <span>{t("startNewChat")}</span>
    </Button>
  );

  if (collapsed) {
    return (
      <div className="flex shrink-0 flex-col items-center gap-0.5 border-b border-border py-2">
        <SidebarIconButton
          label={t("searchAria")}
          onClick={onSearchOpen}
          disabled={isLoading}
        >
          <Search className="size-4" />
        </SidebarIconButton>
        <SidebarIconButton
          label={t("startNewChat")}
          onClick={onCreateChat}
          disabled={isCreating}
        >
          <MessageSquarePlus className="size-4" />
        </SidebarIconButton>
      </div>
    );
  }

  return (
    <div className="flex w-full shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
      {newChatButton}
      <SidebarIconButton
        label={t("searchAria")}
        onClick={onSearchOpen}
        disabled={isLoading}
        tooltipSide="bottom"
      >
        <Search className="size-4" />
      </SidebarIconButton>
    </div>
  );
}

interface ChatHistorySidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatHistorySidebar({
  open,
  onOpenChange,
}: ChatHistorySidebarProps) {
  const t = useTranslations("chatPage");
  const locale = useLocale();
  const [searchOpen, setSearchOpen] = useState(false);
  const {
    chats,
    activeChatId,
    isLoading,
    isCreating,
    selectChat,
    createNewChat,
    removeChat,
  } = useChatHistory();

  const handleSelectFromSearch = (chatId: string) => {
    selectChat(chatId);
    setSearchOpen(false);
  };

  const commandDialog = (
    <CommandDialog
      open={searchOpen}
      onOpenChange={setSearchOpen}
      title={t("searchPlaceholder")}
      description={t("listSubtitle")}
    >
      <Command>
        <CommandInput placeholder={t("searchPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("searchNoResults")}</CommandEmpty>
          <CommandGroup>
            {chats.map((chat) => {
              const label = chatListLabel(chat, t);
              const timeLabel = formatChatTime(
                chat.last_message_at ?? chat.updated_at,
                locale
              );
              return (
                <CommandItem
                  key={chat.uuid}
                  value={`${label} ${chat.last_message_preview ?? ""}`}
                  onSelect={() => handleSelectFromSearch(chat.uuid)}
                >
                  <span className="truncate">{label}</span>
                  {timeLabel ? (
                    <CommandShortcut>{timeLabel}</CommandShortcut>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );

  if (!open) {
    return (
      <aside
        className="flex h-full w-12 shrink-0 flex-col border-r border-border bg-muted/20"
        aria-label={t("listTitle")}
      >
        <SidebarHeaderActions
          isLoading={isLoading}
          isCreating={isCreating}
          onSearchOpen={() => setSearchOpen(true)}
          onCreateChat={() => void createNewChat()}
          t={t}
          collapsed
        />
        {commandDialog}
        <SidebarFooterToggle
          open={open}
          onOpenChange={onOpenChange}
          t={t}
          collapsed
        />
      </aside>
    );
  }

  return (
    <aside
      className="flex h-full w-70 shrink-0 flex-col border-r border-border bg-muted/20"
      aria-label={t("listTitle")}
    >
      <SidebarHeaderActions
        isLoading={isLoading}
        isCreating={isCreating}
        onSearchOpen={() => setSearchOpen(true)}
        onCreateChat={() => void createNewChat()}
        t={t}
      />

      {commandDialog}

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <SidebarSkeleton />
        ) : chats.length === 0 ? (
          <div className="ps-4 pe-4 py-8 text-center text-xs text-muted-foreground">
            {t("emptyTitle")}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {chats.map((chat) => (
              <ChatHistoryItem
                key={chat.uuid}
                chat={chat}
                isActive={activeChatId === chat.uuid}
                locale={locale}
                onSelect={() => selectChat(chat.uuid)}
                onDelete={() => void removeChat(chat.uuid)}
                t={t}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <SidebarFooterToggle open={open} onOpenChange={onOpenChange} t={t} />
    </aside>
  );
}
