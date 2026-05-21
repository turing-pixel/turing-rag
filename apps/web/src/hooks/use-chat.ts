"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  readDataStream,
  StreamEmptyResponseError,
  StreamIdleTimeoutError,
} from "@/lib/ai-data-stream";
import {
  ApiError,
  parseHttpErrorResponse,
  redirectToLoginIfUnauthorized,
} from "@/lib/api";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Array<{
    id: number;
    text: string;
    metadata: Record<string, unknown>;
  }>;
}

interface UseChatOptions {
  api: string;
  headers?: Record<string, string>;
  /** User-facing message when the stream closes without any text. */
  streamEmptyMessage?: string;
  /** User-facing message when the stream stalls (idle timeout). */
  streamTimeoutMessage?: string;
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

export function useChat({
  api,
  headers,
  streamEmptyMessage = "Stream ended without a response",
  streamTimeoutMessage = "Connection timed out while waiting for a response",
}: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
      setIsLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let hadPartialResponse = false;

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ messages: nextMessages }),
          signal: controller.signal,
        });

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
            appendToAssistant(assistantId, chunk);
          },
          { requireText: true }
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) => {
            if (getAssistantContent(prev, assistantId)) {
              return prev;
            }
            return prev.filter((msg) => msg.id !== assistantId);
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
          hadPartialResponse = Boolean(getAssistantContent(prev, assistantId));
          if (hadPartialResponse) {
            return prev;
          }
          return prev.filter((msg) => msg.id !== assistantId);
        });

        if (!hadPartialResponse) {
          setInput(content);
        }
        setError(message);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [
      api,
      appendToAssistant,
      headers,
      input,
      isLoading,
      messages,
      streamEmptyMessage,
      streamTimeoutMessage,
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
  };
}
