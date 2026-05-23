"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import {
  createChat,
  deleteChat,
  listChats,
  type ChatSummary,
} from "@/lib/chat-list";
import type { KnowledgeBaseOption } from "@/components/chat/knowledge-base-picker";
import {
  chatConversationPath,
  chatIndexPath,
  parseRouteChatId,
} from "@/lib/chat-paths";

interface ChatHistoryContextValue {
  chats: ChatSummary[];
  activeChatId: string | null;
  isLoading: boolean;
  isCreating: boolean;
  refreshChats: () => Promise<void>;
  selectChat: (chatId: string) => void;
  createNewChat: () => Promise<string | null>;
  removeChat: (chatId: string) => Promise<void>;
}

const ChatHistoryContext = createContext<ChatHistoryContextValue | null>(null);

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("chatPage");

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const activeChatId = useMemo(
    () => parseRouteChatId(params.id),
    [params.id]
  );

  const refreshChats = useCallback(async () => {
    try {
      const list = await listChats();
      setChats(list);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("chatLoadError");
      toast.error(message);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      try {
        const list = await listChats();
        if (!cancelled) setChats(list);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiError ? err.message : t("chatLoadError");
          toast.error(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const selectChat = useCallback(
    (chatId: string) => {
      router.push(chatConversationPath(chatId));
    },
    [router]
  );

  const createNewChat = useCallback(async (): Promise<string | null> => {
    setIsCreating(true);
    try {
      const kbs = (await api.get("/api/knowledge-base")) as KnowledgeBaseOption[];
      if (kbs.length === 0) {
        toast.error(t("noKbTitle"), { description: t("noKbBody") });
        return null;
      }
      const primary = kbs[0];
      const chat = await createChat({
        title: t("defaultChatTitle", { name: primary.name }),
        knowledgeBaseUuids: [primary.uuid],
      });
      await refreshChats();
      selectChat(chat.uuid);
      return chat.uuid;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("createChatFailed");
      toast.error(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [refreshChats, selectChat, t]);

  const removeChat = useCallback(
    async (chatId: string) => {
      try {
        await deleteChat(chatId);
        const next = chats.filter((c) => c.uuid !== chatId);
        setChats(next);
        if (activeChatId === chatId) {
          if (next.length > 0) {
            selectChat(next[0].uuid);
          } else {
            const id = await createNewChat();
            if (id == null) {
              router.push(chatIndexPath());
            }
          }
        }
        toast.success(t("deleteChatSuccess"));
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : t("deleteChatFailed");
        toast.error(message);
      }
    },
    [activeChatId, chats, createNewChat, router, selectChat, t]
  );

  const value = useMemo(
    () => ({
      chats,
      activeChatId,
      isLoading,
      isCreating,
      refreshChats,
      selectChat,
      createNewChat,
      removeChat,
    }),
    [
      chats,
      activeChatId,
      isLoading,
      isCreating,
      refreshChats,
      selectChat,
      createNewChat,
      removeChat,
    ]
  );

  return (
    <ChatHistoryContext.Provider value={value}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory(): ChatHistoryContextValue {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) {
    throw new Error("useChatHistory must be used within ChatHistoryProvider");
  }
  return ctx;
}
