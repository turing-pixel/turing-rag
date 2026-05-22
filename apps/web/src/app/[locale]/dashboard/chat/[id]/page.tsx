"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useChatHistory } from "@/components/chat/chat-history-context";
import { useChat, type ChatMessage as UIChatMessage } from "@/hooks/use-chat";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUp, Library, Square } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, getAuthHeaders } from "@/lib/api";
import { getApiBase } from "@/lib/public-urls";
import {
  formatChatHistoryMessages,
  isContextPrefixOnly,
  parseAssistantMessage,
} from "@/lib/chat-message";
import {
  applyKnowledgeBasesFromQuery,
  loadChatById,
  parseKbIdsFromSearchParams,
  updateWorkspaceKnowledgeBases,
} from "@/lib/chat-session";
import {
  INITIAL_RETRIEVAL_STREAM_STATE,
  retrievalStreamToCitations,
} from "@/lib/chat-retrieval-stream";
import { Answer } from "@/components/chat/answer";
import { ChatMessageBlock } from "@/components/chat/chat-message-actions";
import { ChatMessageEditDialog } from "@/components/chat/chat-message-edit-dialog";
import { patchChatMessage } from "@/lib/chat-api";
import {
  KnowledgeBasePicker,
  type KnowledgeBaseOption,
} from "@/components/chat/knowledge-base-picker";
import { RetrievalStatusPanel } from "@/components/chat/retrieval-status-panel";
import { ModelSelector } from "@/components/chat/model-selector";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { chatIndexPath, parseRouteChatId } from "@/lib/chat-paths";
import { ChatConversationSkeleton } from "@/components/skeletons/chat-conversation-skeleton";

function ChatPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const t = useTranslations("chatPage");
  const locale = useLocale();
  const { refreshChats } = useChatHistory();

  const routeChatId = useMemo(
    () => parseRouteChatId(params.id),
    [params.id]
  );
  const formRef = useRef<HTMLFormElement>(null);
  const kbPatchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [chatId, setChatId] = useState<string | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseOption[]>(
    []
  );
  const [selectedKbIds, setSelectedKbIds] = useState<number[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isUpdatingKbs, setIsUpdatingKbs] = useState(false);
  const [modelProviders, setModelProviders] = useState<
    LlmModelsResponse["providers"]
  >([]);
  const [selectedModel, setSelectedModel] = useState<LlmSelection | null>(null);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const messagesApi =
    chatId != null ? `${getApiBase()}/api/chat/${chatId}/messages` : "";

  const {
    scrollRef: messagesScrollRef,
    contentRef: messagesContentRef,
    followContent,
    pinAndScrollToBottom,
    scrollToBottomAfterLayout,
  } = useChatScroll({ throttleMs: 100, scrollDebounceMs: 150 });

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    stop,
    isLoading,
    error,
    setMessages,
    retrievalStream,
    setRetrievalStream,
    regenerateMessage,
    regenerateAfterUserEdit,
    setMessageFeedback,
  } = useChat({
    api: messagesApi || `${getApiBase()}/api/chat/0/messages`,
    chatId,
    headers: getAuthHeaders(),
    streamEmptyMessage: t("streamEmpty"),
    streamTimeoutMessage: t("streamTimeout"),
    onStreamComplete: () => {
      void refreshChats();
    },
  });

  const persistKnowledgeBases = useCallback(
    async (ids: number[]) => {
      if (chatId == null) return;
      setIsUpdatingKbs(true);
      try {
        await updateWorkspaceKnowledgeBases(chatId, ids);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : t("kbsUpdateFailed");
        toast.error(message);
        throw err;
      } finally {
        setIsUpdatingKbs(false);
      }
    },
    [chatId, t]
  );

  const handleKbSelectionChange = useCallback(
    (ids: number[]) => {
      setSelectedKbIds(ids);
      if (chatId == null) return;
      if (kbPatchRef.current) clearTimeout(kbPatchRef.current);
      kbPatchRef.current = setTimeout(() => {
        void persistKnowledgeBases(ids);
      }, 400);
    },
    [chatId, persistKnowledgeBases]
  );

  const initChat = useCallback(
    async (targetChatId: string) => {
      setIsPageLoading(true);
      stop();
      setMessages([]);
      setRetrievalStream(INITIAL_RETRIEVAL_STREAM_STATE);

      try {
        const [chat, kbs, models] = await Promise.all([
          loadChatById(targetChatId),
          api.get("/api/knowledge-base") as Promise<KnowledgeBaseOption[]>,
          api.get("/api/chat/models") as Promise<LlmModelsResponse>,
        ]);

        setKnowledgeBases(kbs);
        setModelProviders(models.providers);
        setChatId(chat.id);
        setMessages(
          formatChatHistoryMessages(chat.messages) as UIChatMessage[]
        );

        const queryKbIds = parseKbIdsFromSearchParams(searchParams);
        let kbIds = chat.knowledge_base_ids ?? [];
        if (queryKbIds.length > 0) {
          const valid = queryKbIds.filter((id) =>
            kbs.some((kb) => kb.id === id)
          );
          if (valid.length > 0) {
            kbIds = valid;
            await applyKnowledgeBasesFromQuery(chat.id, valid);
          }
        }
        setSelectedKbIds(kbIds);

        if (chat.llm_config_id != null) {
          setSelectedModel(
            selectionFromProviders(models.providers, {
              configId: chat.llm_config_id,
              provider: chat.llm_provider ?? "",
              model: chat.llm_model ?? "",
            })
          );
        } else if (chat.llm_provider && chat.llm_model) {
          setSelectedModel({
            provider: chat.llm_provider,
            model: chat.llm_model,
          });
        } else {
          setSelectedModel(getDefaultSelection(models));
        }
      } catch (err) {
        console.error("Failed to init chat:", err);
        const message =
          err instanceof ApiError ? err.message : t("loadChatFailed");
        toast.error(message);
      } finally {
        setIsPageLoading(false);
      }
    },
    [searchParams, setMessages, setRetrievalStream, stop, t]
  );

  useEffect(() => {
    const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
    if (rawId === "new") {
      router.replace(chatIndexPath(searchParams));
      return;
    }
    if (routeChatId == null) {
      router.replace(chatIndexPath(searchParams));
      return;
    }
    void initChat(routeChatId);
    return () => {
      if (kbPatchRef.current) clearTimeout(kbPatchRef.current);
    };
  }, [routeChatId, initChat, router, searchParams]);

  useEffect(() => {
    if (isPageLoading || messages.length === 0) return;
    scrollToBottomAfterLayout("auto");
  }, [isPageLoading, messages.length, scrollToBottomAfterLayout]);

  const handleModelChange = async (nextModel: LlmSelection) => {
    if (chatId == null) return;
    const previousModel = selectedModel;
    setSelectedModel(nextModel);
    setIsUpdatingModel(true);
    try {
      await api.patch(`/api/chat/${chatId}`, {
        llm_config_id: nextModel.configId ?? null,
        llm_provider: nextModel.configId ? null : nextModel.provider,
        llm_model: nextModel.configId ? null : nextModel.model,
      });
      toast.success(t("modelUpdated"));
    } catch (err) {
      setSelectedModel(previousModel);
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(t("modelUpdateFailed"));
      }
    } finally {
      setIsUpdatingModel(false);
    }
  };

  useEffect(() => {
    if (!error) return;
    toast.error(t("sendFailed"), { description: error });
  }, [error, t]);

  const linkedKbs = useMemo(
    () => knowledgeBases.filter((kb) => selectedKbIds.includes(kb.id)),
    [knowledgeBases, selectedKbIds]
  );

  const streamCitations = useMemo(
    () => retrievalStreamToCitations(retrievalStream),
    [retrievalStream]
  );

  const processedMessages = useMemo(() => {
    const streamCitationsForUi =
      streamCitations.length > 0 ? streamCitations : undefined;

    return messages.map((message, index) => {
      if (message.role !== "assistant") return message;
      if (!message.content) return message;

      if (message.citations?.length) {
        return message;
      }

      const isStreamingLast = isLoading && index === messages.length - 1;

      if (isStreamingLast) {
        const hasSeparator = message.content.includes("__LLM_RESPONSE__");
        if (!hasSeparator) {
          if (isContextPrefixOnly(message.content)) {
            return { ...message, content: "" };
          }
          return message;
        }
        const parsed = parseAssistantMessage(message.content);
        return {
          ...message,
          content: parsed.content,
          citations: parsed.citations ?? streamCitationsForUi,
        };
      }

      const parsed = parseAssistantMessage(message.content);
      const isLast = index === messages.length - 1;
      return {
        ...message,
        content: parsed.content,
        citations:
          parsed.citations ??
          message.citations ??
          (isLast ? streamCitationsForUi : undefined),
      };
    });
  }, [messages, isLoading, streamCitations]);

  const assistantAnswerState = useMemo(() => {
    const last = messages.at(-1);
    if (last?.role !== "assistant") {
      return { started: false, finished: false };
    }
    const hasSeparator = last.content.includes("__LLM_RESPONSE__");
    const parsed = parseAssistantMessage(last.content);
    const hasVisibleAnswer = parsed.content.trim().length > 0;
    return {
      started: hasSeparator,
      finished: hasSeparator || hasVisibleAnswer,
    };
  }, [messages]);

  const answerStreamStarted = isLoading && assistantAnswerState.started;
  const answerFinished = !isLoading && assistantAnswerState.finished;

  const hasRetrievalStream = retrievalStream.phase != null;

  const hasRetrievalSources = retrievalStream.documents.length > 0;
  const lastMessageIsAssistant =
    processedMessages.at(-1)?.role === "assistant";

  const showRetrievalPanel = useMemo(() => {
    if (isLoading) {
      if (hasRetrievalStream) return true;
      if (answerStreamStarted) return true;
      const last = processedMessages.at(-1);
      return last?.role !== "assistant" || !last.content;
    }
    return hasRetrievalSources && lastMessageIsAssistant;
  }, [
    isLoading,
    hasRetrievalStream,
    hasRetrievalSources,
    lastMessageIsAssistant,
    answerStreamStarted,
    processedMessages,
  ]);

  const linkedKbNamesLabel = useMemo(() => {
    if (linkedKbs.length === 0) return null;
    if (linkedKbs.length === 1) {
      const name = linkedKbs[0].name;
      return locale.startsWith("zh") ? `「${name}」` : name;
    }
    const separator = locale.startsWith("zh") ? "、" : ", ";
    return linkedKbs.map((kb) => kb.name).join(separator);
  }, [linkedKbs, locale]);

  const scrollAnchorKey = useMemo(() => {
    const last = processedMessages.at(-1);
    return `${processedMessages.length}:${last?.role ?? ""}:${last?.content?.length ?? 0}:${showRetrievalPanel}:${retrievalStream.phase ?? ""}:${answerStreamStarted}:${retrievalStream.documents.length}`;
  }, [
    processedMessages,
    showRetrievalPanel,
    retrievalStream.phase,
    retrievalStream.documents.length,
    answerStreamStarted,
  ]);

  useEffect(() => {
    followContent({ streaming: isLoading });
  }, [scrollAnchorKey, isLoading, followContent]);

  const showWelcome = processedMessages.length === 0 && !isLoading;
  const welcomeKbName = linkedKbs.map((kb) => kb.name).join(", ");
  const noKnowledgeBases = !isPageLoading && knowledgeBases.length === 0;

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading || chatId == null) return;
    if (selectedKbIds.length === 0) {
      toast.error(t("selectKbBeforeSend"));
      return;
    }
    pinAndScrollToBottom("auto");
    handleSubmit(e);
  };

  const handleSaveEdit = async (newContent: string) => {
    if (!editTarget || chatId == null) return;
    setIsSavingEdit(true);
    try {
      await patchChatMessage(chatId, Number.parseInt(editTarget.id, 10), {
        content: newContent,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editTarget.id ? { ...m, content: newContent } : m
        )
      );
      setEditTarget(null);
      await regenerateAfterUserEdit(editTarget.id);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("editMessageFailed");
      toast.error(message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  if (isPageLoading) {
    return <ChatConversationSkeleton />;
  }

  if (noKnowledgeBases) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center px-4">
        <Empty className="max-w-md border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Library />
            </EmptyMedia>
            <EmptyTitle>{t("noKbTitle")}</EmptyTitle>
            <EmptyDescription>{t("noKbBody")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/dashboard/knowledge/new">{t("goCreateKb")}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <h1 className="sr-only">{t("pageTitle")}</h1>

      <ScrollArea
        ref={messagesScrollRef}
        className="min-h-0 flex-1"
        viewportClassName="overscroll-y-contain"
      >
        <div
          ref={messagesContentRef}
          className="mx-auto flex w-full max-w-5xl flex-col gap-0 py-6"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
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

            const actionDisabled = isLoading || isSavingEdit;

            return message.role === "assistant" ? (
              <ChatMessageBlock
                key={message.id}
                role="assistant"
                copyText={message.content}
                feedback={message.feedback}
                actionDisabled={actionDisabled}
                actionHandlers={{
                  onRegenerate: () => regenerateMessage(message.id),
                  onFeedback: (fb) => setMessageFeedback(message.id, fb),
                }}
              >
                <Answer
                  markdown={message.content}
                  citations={message.citations}
                />
              </ChatMessageBlock>
            ) : (
              <ChatMessageBlock
                key={message.id}
                role="user"
                copyText={message.content}
                actionDisabled={actionDisabled}
                actionHandlers={{
                  onEdit: () =>
                    setEditTarget({
                      id: message.id,
                      content: message.content,
                    }),
                }}
              >
                <p className="max-w-[min(100%,32rem)] wrap-break-word whitespace-pre-wrap rounded-2xl bg-muted/70 px-3 py-2 text-[0.9375rem] leading-relaxed text-foreground">
                  {message.content}
                </p>
              </ChatMessageBlock>
            );
          })}

          {showRetrievalPanel ? (
            <RetrievalStatusPanel
              retrievalStream={retrievalStream}
              isStreaming={isLoading}
              answerStarted={answerStreamStarted}
              answerFinished={answerFinished}
              linkedKbNamesLabel={linkedKbNamesLabel}
            />
          ) : null}
        </div>
      </ScrollArea>

      <footer className="shrink-0 px-4 py-3 sm:px-6 lg:px-8">
        <form
          ref={formRef}
          onSubmit={onFormSubmit}
          className="mx-auto w-full max-w-5xl space-y-2"
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
              disabled={isLoading || chatId == null}
            />
            <InputGroupAddon align="block-end" className="justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <ModelSelector
                  providers={modelProviders}
                  value={selectedModel}
                  onValueChange={(nextModel) => {
                    void handleModelChange(nextModel);
                  }}
                  disabled={isLoading || isUpdatingModel || chatId == null}
                  size="sm"
                  manageHref="/dashboard/llm-configs"
                />
                <KnowledgeBasePicker
                  knowledgeBases={knowledgeBases}
                  selectedIds={selectedKbIds}
                  onSelectedIdsChange={handleKbSelectionChange}
                  disabled={isLoading || isUpdatingKbs || chatId == null}
                />
              </div>
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
                  disabled={!input.trim() || selectedKbIds.length === 0}
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

      <ChatMessageEditDialog
        open={editTarget != null}
        initialContent={editTarget?.content ?? ""}
        isSubmitting={isSavingEdit}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSubmit={handleSaveEdit}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatConversationSkeleton />}>
      <ChatPageContent />
    </Suspense>
  );
}
