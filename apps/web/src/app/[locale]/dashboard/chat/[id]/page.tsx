"use client";

import { useEffect, useMemo, useRef, useState, use, useCallback } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useChat, type ChatMessage as UIChatMessage } from "@/hooks/use-chat";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowUp, Library, Square } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { api, ApiError, getAuthHeaders } from "@/lib/api";
import { getApiBase } from "@/lib/public-urls";
import {
  formatChatHistoryMessages,
  getAssistantStreamStatus,
  parseAssistantMessage,
} from "@/lib/chat-message";
import { Answer } from "@/components/chat/answer";
import { ModelSelector } from "@/components/chat/model-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  getDefaultSelection,
  selectionFromProviders,
  type LlmModelsResponse,
  type LlmSelection,
} from "@/lib/llm-models";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { ChatConversationSkeleton } from "@/components/skeletons/chat-conversation-skeleton";

interface ChatMessage {
  id: number;
  content: string;
  role: "assistant" | "user";
  created_at: string;
}

interface Chat {
  id: number;
  title: string;
  messages: ChatMessage[];
  knowledge_base_ids: number[];
  llm_config_id?: number | null;
  llm_provider?: string | null;
  llm_model?: string | null;
}

interface LinkedKnowledgeBase {
  id: number;
  name: string;
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("chatPage");
  const formRef = useRef<HTMLFormElement>(null);
  const {
    scrollRef: messagesScrollRef,
    contentRef: messagesContentRef,
    followContent,
    pinAndScrollToBottom,
    markSkipNextFollow,
  } = useChatScroll({ throttleMs: 100, scrollDebounceMs: 150 });
  const [chatTitle, setChatTitle] = useState("");
  const [linkedKbs, setLinkedKbs] = useState<LinkedKnowledgeBase[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [modelProviders, setModelProviders] = useState<
    LlmModelsResponse["providers"]
  >([]);
  const [selectedModel, setSelectedModel] = useState<LlmSelection | null>(null);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    stop,
    isLoading,
    error,
    setMessages,
  } = useChat({
    api: `${getApiBase()}/api/chat/${id}/messages`,
    headers: getAuthHeaders(),
    streamEmptyMessage: t("streamEmpty"),
    streamTimeoutMessage: t("streamTimeout"),
  });

  const fetchChat = useCallback(async () => {
    setIsPageLoading(true);

    let data: Chat;
    try {
      data = (await api.get(`/api/chat/${id}`)) as Chat;
    } catch (error) {
      console.error("Failed to fetch chat:", error);
      const message =
        error instanceof ApiError ? error.message : t("loadChatFailed");
      toast.error(message);
      router.push("/dashboard/chat");
      setIsPageLoading(false);
      return;
    }

    setChatTitle(data.title);
    setMessages(formatChatHistoryMessages(data.messages) as UIChatMessage[]);
    markSkipNextFollow();

    const [modelsResult, kbsResult] = await Promise.allSettled([
      api.get("/api/chat/models") as Promise<LlmModelsResponse>,
      api.get("/api/knowledge-base") as Promise<
        Array<{ id: number; name: string }>
      >,
    ]);

    if (modelsResult.status === "fulfilled") {
      const modelsData = modelsResult.value;
      setModelProviders(modelsData.providers);
      if (data.llm_config_id != null) {
        setSelectedModel(
          selectionFromProviders(modelsData.providers, {
            configId: data.llm_config_id,
            provider: data.llm_provider ?? "",
            model: data.llm_model ?? "",
          })
        );
      } else if (data.llm_provider && data.llm_model) {
        setSelectedModel({
          provider: data.llm_provider,
          model: data.llm_model,
        });
      } else {
        setSelectedModel(getDefaultSelection(modelsData));
      }
    } else {
      console.error("Failed to fetch chat models:", modelsResult.reason);
      const message =
        modelsResult.reason instanceof ApiError
          ? modelsResult.reason.message
          : t("modelsLoadFailed");
      toast.error(message);
    }

    if (kbsResult.status === "fulfilled") {
      setLinkedKbs(
        kbsResult.value
          .filter((kb) => data.knowledge_base_ids?.includes(kb.id))
          .map((kb) => ({ id: kb.id, name: kb.name }))
      );
    } else {
      console.error("Failed to fetch knowledge bases:", kbsResult.reason);
      toast.error(t("kbsLoadFailed"));
    }

    setIsPageLoading(false);
  }, [id, markSkipNextFollow, router, setMessages, t]);

  const handleModelChange = async (nextModel: LlmSelection) => {
    const previousModel = selectedModel;
    setSelectedModel(nextModel);
    setIsUpdatingModel(true);
    try {
      await api.patch(`/api/chat/${id}`, {
        llm_config_id: nextModel.configId ?? undefined,
        llm_provider: nextModel.configId ? undefined : nextModel.provider,
        llm_model: nextModel.configId ? undefined : nextModel.model,
      });
      toast.success(t("modelUpdated"));
    } catch (error) {
      setSelectedModel(previousModel);
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error(t("modelUpdateFailed"));
      }
    } finally {
      setIsUpdatingModel(false);
    }
  };

  useEffect(() => {
    void fetchChat();
  }, [fetchChat]);

  useEffect(() => {
    if (!error) return;
    toast.error(t("sendFailed"), { description: error });
  }, [error, t]);

  const processedMessages = useMemo(() => {
    return messages.map((message) => {
      if (message.role !== "assistant") return message;
      if (!message.content) return message;

      if (message.citations?.length) {
        return message;
      }

      const parsed = parseAssistantMessage(message.content);
      return {
        ...message,
        content: parsed.content,
        citations: parsed.citations ?? message.citations,
      };
    });
  }, [messages]);

  const streamStatus = useMemo(() => {
    if (!isLoading) return null;
    const last = messages.at(-1);
    const raw =
      last?.role === "assistant" ? last.content : "";
    return getAssistantStreamStatus(raw, true);
  }, [isLoading, messages]);

  const showStreamStatus = useMemo(() => {
    if (!streamStatus) return false;
    const last = processedMessages.at(-1);
    return last?.role !== "assistant" || !last.content;
  }, [streamStatus, processedMessages]);

  const streamStatusLabel = useMemo(() => {
    if (!streamStatus) return "";
    if (streamStatus.phase === "retrieving") {
      return t("retrieving");
    }
    if (streamStatus.citationCount != null) {
      return t("generatingWithSources", {
        count: streamStatus.citationCount,
      });
    }
    return t("generating");
  }, [streamStatus, t]);

  const scrollAnchorKey = useMemo(() => {
    const last = processedMessages.at(-1);
    return `${processedMessages.length}:${last?.role ?? ""}:${last?.content?.length ?? 0}:${showStreamStatus}:${streamStatusLabel}`;
  }, [processedMessages, showStreamStatus, streamStatusLabel]);

  useEffect(() => {
    followContent({ streaming: isLoading });
  }, [scrollAnchorKey, isLoading, followContent]);

  const showWelcome = processedMessages.length === 0 && !isLoading;

  const welcomeKbName = linkedKbs.map((kb) => kb.name).join(", ");

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    pinAndScrollToBottom("auto");
    handleSubmit(e);
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  if (isPageLoading) {
    return (
      <DashboardLayout>
        <ChatConversationSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <h1 className="sr-only">{chatTitle || t("listTitle")}</h1>

        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 sm:px-6 lg:px-8">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href="/dashboard/chat" aria-label={t("backToList")}>
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 truncate text-sm font-medium leading-tight">
              {chatTitle || "—"}
            </p>
            {linkedKbs.length > 0 ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {linkedKbs.map((kb) => (
                  <Badge key={kb.id} variant="secondary" asChild>
                    <Link href={`/dashboard/knowledge/${kb.id}`}>
                      <Library />
                      {kb.name}
                    </Link>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        <div
          ref={messagesScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-6 sm:px-6 lg:px-8"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div
              ref={messagesContentRef}
              className="mx-auto w-full max-w-3xl space-y-8"
            >
              {showWelcome ? (
                <Empty className="border border-dashed py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Library />
                    </EmptyMedia>
                    <EmptyTitle>{t("welcomeTitle")}</EmptyTitle>
                    <EmptyDescription>
                      {welcomeKbName
                        ? t("welcomeDescription", { kb: welcomeKbName })
                        : t("welcomeDescriptionNoKb")}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}

              {processedMessages.map((message, index) => {
                const hideEmptyStreamingAssistant =
                  isLoading &&
                  message.role === "assistant" &&
                  !message.content &&
                  index === processedMessages.length - 1;
                if (hideEmptyStreamingAssistant) return null;

                return message.role === "assistant" ? (
                  <article
                    key={message.id}
                    className="flex gap-3"
                    aria-label="Assistant"
                  >
                    <Image
                      src="/logo.png"
                      alt={t("logoAlt")}
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded-full"
                      sizes="32px"
                    />
                    <div className="min-w-0 flex-1">
                      <Answer
                        markdown={message.content}
                        citations={message.citations}
                      />
                    </div>
                  </article>
                ) : (
                  <article
                    key={message.id}
                    className="flex justify-end"
                    aria-label="You"
                  >
                    <div className="max-w-[min(100%,28rem)] rounded-lg border bg-muted px-4 py-2.5 text-sm">
                      <p className="wrap-break-word whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                  </article>
                );
              })}

              {showStreamStatus ? (
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  aria-live="polite"
                >
                  <Spinner className="size-4" />
                  <span>{streamStatusLabel}</span>
                </div>
              ) : null}
            </div>
        </div>

        <footer className="shrink-0 px-4 py-3 sm:px-6 lg:px-8">
          <form
            ref={formRef}
            onSubmit={onFormSubmit}
            className="mx-auto w-full max-w-3xl space-y-2"
          >
            <InputGroup>
              <label htmlFor="chat-composer" className="sr-only">
                {t("messagePlaceholder")}
              </label>
              <InputGroupTextarea
                id="chat-composer"
                name="message"
                value={input}
                onChange={handleInputChange}
                onKeyDown={onComposerKeyDown}
                placeholder={t("messagePlaceholder")}
                rows={3}
                autoComplete="off"
                disabled={isLoading}
              />
              <InputGroupAddon align="block-end" className="justify-between">
                <ModelSelector
                  providers={modelProviders}
                  value={selectedModel}
                  onValueChange={(nextModel) => {
                    void handleModelChange(nextModel);
                  }}
                  disabled={isLoading || isUpdatingModel}
                  size="sm"
                  manageHref="/dashboard/llm-configs"
                />
                {isLoading ? (
                  <InputGroupButton
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={stop}
                    aria-label={t("stopGeneration")}
                  >
                    <Square />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    disabled={!input.trim()}
                    aria-label={t("sendMessage")}
                  >
                    <ArrowUp />
                  </InputGroupButton>
                )}
              </InputGroupAddon>
            </InputGroup>
            <p className="hidden text-center text-xs text-muted-foreground sm:block">
              {t("composerShortcutHint")}
            </p>
          </form>
        </footer>
      </div>
    </DashboardLayout>
  );
}
