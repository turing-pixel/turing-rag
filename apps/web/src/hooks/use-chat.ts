"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import {
  readDataStream,
  StreamEmptyResponseError,
  StreamIdleTimeoutError,
} from "@/lib/ai-data-stream";
import {
  INITIAL_RETRIEVAL_STREAM_STATE,
  retrievalStateFromApi,
  type RetrievalStreamState,
} from "@/lib/chat-retrieval-stream";
import { applyRetrievalStreamItems } from "@/lib/apply-retrieval-stream-items";
import { applyStreamMessageIds } from "@/lib/apply-stream-message-ids";
import { formatChatHistoryMessages } from "@/lib/chat-message";
import { patchChatMessage, type MessageFeedback } from "@/lib/chat-api";
import { loadChatById } from "@/lib/chat-session";
import {
  ApiError,
  parseHttpErrorResponse,
  redirectToLoginIfUnauthorized,
} from "@/lib/api";
import { getApiBase } from "@/lib/public-urls";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  feedback?: MessageFeedback;
  citations?: Array<{
    id: number;
    text: string;
    metadata: Record<string, unknown>;
  }>;
}

interface UseChatOptions {
  api: string;
  chatId?: string | null;
  headers?: Record<string, string>;
  streamEmptyMessage?: string;
  streamTimeoutMessage?: string;
  onStreamComplete?: () => void;
}

function createMessageId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getAssistantContent(
  messages: ChatMessage[],
  assistantId: string
): string {
  return messages.find((msg) => msg.id === assistantId)?.content.trim() ?? "";
}

function parseDbMessageId(id: string): number | null {
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Replace optimistic UUID messages with DB-backed ids after stream completes. */
async function syncMessagesFromChat(
  chatId: string,
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
  setRetrievalStream: Dispatch<SetStateAction<RetrievalStreamState>>
): Promise<void> {
  const chat = await loadChatById(chatId);
  setMessages(formatChatHistoryMessages(chat.messages) as ChatMessage[]);
  const lastAssistant = [...chat.messages]
    .reverse()
    .find((m) => m.role === "assistant");
  setRetrievalStream(
    retrievalStateFromApi(
      lastAssistant?.retrieval ?? null,
      lastAssistant?.sources ?? []
    )
  );
}

export function useChat({
  api,
  chatId = null,
  headers,
  streamEmptyMessage = "Stream ended without a response",
  streamTimeoutMessage = "Connection timed out while waiting for a response",
  onStreamComplete,
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrievalStream, setRetrievalStream] =
    useState<RetrievalStreamState>(INITIAL_RETRIEVAL_STREAM_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const messageIdsSyncedRef = useRef(false);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const appendToAssistant = useCallback((assistantId: string, chunk: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: msg.content + chunk }
          : msg
      )
    );
  }, []);

  const runAssistantStream = useCallback(
    async (
      response: Response,
      assistantId: string,
      options?: { restoreInput?: string; userMessageId?: string }
    ) => {
      let hadPartialResponse = false;
      messageIdsSyncedRef.current = false;
      const streamingAssistantIdRef = { current: assistantId };

      try {
        if (response.status === 401) {
          redirectToLoginIfUnauthorized();
          throw new ApiError(401, "Unauthorized - Please log in again");
        }

        if (!response.ok) {
          throw new ApiError(
            response.status,
            await parseHttpErrorResponse(response)
          );
        }

        if (!response.body) {
          throw new Error("Response body is empty");
        }

        await readDataStream(
          response.body,
          (chunk) => {
            appendToAssistant(streamingAssistantIdRef.current, chunk);
          },
          {
            requireText: true,
            onData: async (items) => {
              const idResult = applyStreamMessageIds(setMessages, items, {
                assistantId,
                userId: options?.userMessageId,
              });
              if (idResult.applied) {
                messageIdsSyncedRef.current = true;
                if (idResult.assistantId) {
                  streamingAssistantIdRef.current = idResult.assistantId;
                }
              }
              await applyRetrievalStreamItems(setRetrievalStream, items);
            },
          }
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) => {
            const activeId = streamingAssistantIdRef.current;
            if (
              getAssistantContent(prev, activeId) ||
              getAssistantContent(prev, assistantId)
            ) {
              return prev;
            }
            const drop = new Set([assistantId, activeId]);
            if (options?.userMessageId) {
              drop.add(options.userMessageId);
            }
            return prev.filter((msg) => !drop.has(msg.id));
          });
          return;
        }

        let message: string;
        if (err instanceof ApiError) {
          message = err.message;
        } else if (err instanceof StreamIdleTimeoutError) {
          message = streamTimeoutMessage;
        } else if (err instanceof StreamEmptyResponseError) {
          message = streamEmptyMessage;
        } else {
          message =
            err instanceof Error ? err.message : "Failed to send message";
        }

        setMessages((prev) => {
          const activeId = streamingAssistantIdRef.current;
          hadPartialResponse = Boolean(
            getAssistantContent(prev, activeId) ||
              getAssistantContent(prev, assistantId)
          );
          if (hadPartialResponse) {
            return prev;
          }
          return prev.filter(
            (msg) => msg.id !== assistantId && msg.id !== activeId
          );
        });

        if (!hadPartialResponse && options?.restoreInput) {
          setInput(options.restoreInput);
        }
        setError(message);
      }
    },
    [
      appendToAssistant,
      streamEmptyMessage,
      streamTimeoutMessage,
    ]
  );

  const startRegenerateStream = useCallback(
    async (targetMessageId: number, truncateToIndex: number) => {
      if (chatId == null || isLoading) return;

      const assistantId = createMessageId();
      setMessages((prev) => [
        ...prev.slice(0, truncateToIndex),
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setError(null);
      setRetrievalStream(INITIAL_RETRIEVAL_STREAM_STATE);
      setIsLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const url = `${getApiBase()}/api/chat/${chatId}/messages/${targetMessageId}/regenerate`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          signal: controller.signal,
        });
        await runAssistantStream(response, assistantId);
        if (chatId != null && !messageIdsSyncedRef.current) {
          try {
            await syncMessagesFromChat(
              chatId,
              setMessages,
              setRetrievalStream
            );
          } catch (syncErr) {
            console.error("Failed to sync messages after stream:", syncErr);
          }
        }
        onStreamComplete?.();
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [chatId, headers, isLoading, onStreamComplete, runAssistantStream]
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      const dbId = parseDbMessageId(messageId);
      if (dbId == null) return;

      const index = messages.findIndex((m) => m.id === messageId);
      if (index < 0) return;

      await startRegenerateStream(dbId, index);
    },
    [messages, startRegenerateStream]
  );

  const regenerateAfterUserEdit = useCallback(
    async (userMessageId: string) => {
      const dbId = parseDbMessageId(userMessageId);
      if (dbId == null) return;

      const index = messages.findIndex((m) => m.id === userMessageId);
      if (index < 0) return;

      await startRegenerateStream(dbId, index + 1);
    },
    [messages, startRegenerateStream]
  );

  const setMessageFeedback = useCallback(
    async (messageId: string, feedback: MessageFeedback) => {
      if (chatId == null) return;
      const dbId = parseDbMessageId(messageId);
      if (dbId == null) return;

      const current = messages.find((m) => m.id === messageId);
      const nextFeedback =
        current?.feedback === feedback ? null : feedback;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, feedback: nextFeedback } : m
        )
      );

      try {
        await patchChatMessage(chatId, dbId, { feedback: nextFeedback });
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, feedback: current?.feedback } : m
          )
        );
        if (err instanceof ApiError) {
          setError(err.message);
        }
        throw err;
      }
    },
    [chatId, messages]
  );

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const content = input.trim();
      if (!content || isLoading) return;

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content,
      };
      const assistantId = createMessageId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      const nextMessages = [...messages, userMessage];
      setMessages([...nextMessages, assistantMessage]);
      setInput("");
      setError(null);
      setRetrievalStream(INITIAL_RETRIEVAL_STREAM_STATE);
      setIsLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });
        await runAssistantStream(response, assistantId, {
          restoreInput: content,
          userMessageId: userMessage.id,
        });
        if (chatId != null && !messageIdsSyncedRef.current) {
          try {
            await syncMessagesFromChat(
              chatId,
              setMessages,
              setRetrievalStream
            );
          } catch (syncErr) {
            console.error("Failed to sync messages after stream:", syncErr);
          }
        }
        onStreamComplete?.();
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [
      api,
      chatId,
      headers,
      input,
      isLoading,
      messages,
      onStreamComplete,
      runAssistantStream,
    ]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    setMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    stop,
    isLoading,
    error,
    retrievalStream,
    setRetrievalStream,
    regenerateMessage,
    regenerateAfterUserEdit,
    setMessageFeedback,
  };
}
