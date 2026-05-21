"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, MessageSquare, Trash2, Search } from "lucide-react";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { DashboardPageContainer } from "@/components/layout/dashboard-page-container";
import { api, ApiError } from "@/lib/api";
import { lastMessagePreview } from "@/lib/chat-message";
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
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ChatListSkeleton } from "@/components/skeletons/chat-list-skeleton";

interface Chat {
  id: number;
  title: string;
  created_at: string;
  messages: Message[];
  knowledge_base_ids: number[];
}

interface Message {
  id: number;
  content: string;
  role: "assistant" | "user";
  created_at: string;
}

export default function ChatPage() {
  const t = useTranslations("toasts");
  const tPage = useTranslations("chatPage");
  const locale = useLocale();
  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    void fetchChats();
  }, []);

  const fetchChats = async () => {
    setIsLoading(true);
    try {
      const data = await api.get("/api/chat");
      setChats(data);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/chat/${deleteTarget.id}`);
      setChats((prev) => prev.filter((chat) => chat.id !== deleteTarget.id));
      toast.success(t("chatDeleted"));
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete chat:", error);
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showEmpty = !isLoading && chats.length === 0;
  const showNoSearchResults =
    !isLoading &&
    chats.length > 0 &&
    filteredChats.length === 0 &&
    searchTerm.trim() !== "";

  return (
    <DashboardLayout>
      <DashboardPageContainer className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {tPage("listTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tPage("listSubtitle")}
            </p>
          </div>
          <Button asChild className="w-full shrink-0 gap-2 sm:w-auto">
            <Link href="/dashboard/chat/new">
              <Plus className="size-4" />
              {tPage("startNewChat")}
            </Link>
          </Button>
        </header>

        {isLoading ? <ChatListSkeleton /> : null}

        {!isLoading && !showEmpty ? (
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder={tPage("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        ) : null}

        {showEmpty ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquare />
              </EmptyMedia>
              <EmptyTitle>{tPage("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{tPage("emptySubtitle")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild className="gap-2">
                <Link href="/dashboard/chat/new">
                  <Plus className="size-4" />
                  {tPage("startFirstChat")}
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : showNoSearchResults ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {tPage("searchNoResults")}
          </p>
        ) : !isLoading ? (
          <ItemGroup>
            {filteredChats.map((chat) => {
              const lastMessage = chat.messages[chat.messages.length - 1];
              const preview =
                lastMessage?.role === "assistant"
                  ? lastMessagePreview(lastMessage.content)
                  : lastMessage?.content ?? "";
              return (
                <Item key={chat.id} variant="outline" size="sm">
                  <ItemMedia variant="icon">
                    <MessageSquare />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <Link
                      href={`/dashboard/chat/${chat.id}`}
                      className="min-w-0"
                    >
                      <ItemTitle>{chat.title}</ItemTitle>
                      <ItemDescription>
                        {tPage("messagesMeta", {
                          count: chat.messages.length,
                        })}{" "}
                        {"\u2022"}{" "}
                        {new Date(chat.created_at).toLocaleDateString(
                          dateLocale
                        )}
                      </ItemDescription>
                      {preview ? (
                        <ItemDescription className="line-clamp-2">
                          {preview}
                        </ItemDescription>
                      ) : null}
                    </Link>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(chat)}
                      aria-label={tPage("deleteChatTitle")}
                    >
                      <Trash2 />
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        ) : null}

        <AlertDialog
          open={deleteTarget != null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tPage("deleteChatTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {tPage("deleteChatDescription", {
                  title: deleteTarget?.title ?? "",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                {tPage("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isDeleting}
                onClick={(e) => {
                  e.preventDefault();
                  void handleDelete();
                }}
              >
                {isDeleting ? tPage("deleting") : tPage("deleteConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardPageContainer>
    </DashboardLayout>
  );
}
