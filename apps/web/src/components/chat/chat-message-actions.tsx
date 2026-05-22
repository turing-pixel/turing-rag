"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Pencil,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MessageFeedback } from "@/lib/chat-api";
import { cn } from "@/lib/utils";

export type ChatMessageRole = "user" | "assistant";

export interface ChatMessageActionHandlers {
  onRegenerate?: () => void | Promise<void>;
  onEdit?: () => void;
  onFeedback?: (feedback: MessageFeedback) => void | Promise<void>;
}

interface ChatMessageActionsProps {
  role: ChatMessageRole;
  text: string;
  feedback?: MessageFeedback;
  disabled?: boolean;
  align?: "start" | "end";
  className?: string;
  handlers?: ChatMessageActionHandlers;
}

export function ChatMessageActions({
  role,
  text,
  feedback = null,
  disabled = false,
  align,
  className,
  handlers,
}: ChatMessageActionsProps) {
  const t = useTranslations("chatPage");
  const tToast = useTranslations("toasts");
  const [copied, setCopied] = useState(false);

  const resolvedAlign = align ?? (role === "user" ? "end" : "start");
  const isAssistant = role === "assistant";

  const handleCopy = useCallback(async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(tToast("copySuccess"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tToast("copyError"));
    }
  }, [text, tToast]);

  if (!text.trim() && !handlers?.onEdit) {
    return null;
  }

  const actionBtnClass =
    "text-muted-foreground hover:text-foreground disabled:opacity-40";

  return (
    <div
      className={cn(
        "flex h-7 items-center gap-0.5 opacity-0 transition-opacity duration-200",
        "group-hover/message:opacity-100 group-focus-within/message:opacity-100",
        "[@media(hover:none)]:opacity-55",
        resolvedAlign === "end" ? "justify-end" : "justify-start",
        className
      )}
      role="toolbar"
      aria-label={t("messageActionsLabel")}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={actionBtnClass}
            disabled={disabled || !text.trim()}
            onClick={() => void handleCopy()}
            aria-label={copied ? t("copiedMessage") : t("copyMessage")}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {copied ? t("copiedMessage") : t("copyMessage")}
        </TooltipContent>
      </Tooltip>

      {isAssistant && handlers?.onRegenerate ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={actionBtnClass}
              disabled={disabled}
              onClick={() => void handlers.onRegenerate?.()}
              aria-label={t("regenerateMessage")}
            >
              <RefreshCw />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {t("regenerateMessage")}
          </TooltipContent>
        </Tooltip>
      ) : null}

      {!isAssistant && handlers?.onEdit ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={actionBtnClass}
              disabled={disabled}
              onClick={handlers.onEdit}
              aria-label={t("editMessage")}
            >
              <Pencil />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {t("editMessage")}
          </TooltipContent>
        </Tooltip>
      ) : null}

      {isAssistant && handlers?.onFeedback ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className={cn(
                  actionBtnClass,
                  feedback === "like" && "text-primary opacity-100"
                )}
                disabled={disabled}
                onClick={() => void handlers.onFeedback?.("like")}
                aria-label={t("likeMessage")}
                aria-pressed={feedback === "like"}
              >
                <ThumbsUp />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {t("likeMessage")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className={cn(
                  actionBtnClass,
                  feedback === "dislike" && "text-destructive opacity-100"
                )}
                disabled={disabled}
                onClick={() => void handlers.onFeedback?.("dislike")}
                aria-label={t("dislikeMessage")}
                aria-pressed={feedback === "dislike"}
              >
                <ThumbsDown />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {t("dislikeMessage")}
            </TooltipContent>
          </Tooltip>
        </>
      ) : null}
    </div>
  );
}

interface ChatMessageBlockProps {
  role: ChatMessageRole;
  copyText: string;
  feedback?: MessageFeedback;
  actionDisabled?: boolean;
  actionHandlers?: ChatMessageActionHandlers;
  children: ReactNode;
  className?: string;
}

export function ChatMessageBlock({
  role,
  copyText,
  feedback,
  actionDisabled,
  actionHandlers,
  children,
  className,
}: ChatMessageBlockProps) {
  const isUser = role === "user";

  return (
    <article
      tabIndex={-1}
      className={cn(
        "group/message flex min-w-0 flex-col gap-0 outline-none",
        isUser ? "items-end" : "w-full items-start",
        className
      )}
      aria-label={isUser ? "You" : "Assistant"}
    >
      {children}
      <ChatMessageActions
        role={role}
        text={copyText}
        feedback={feedback}
        disabled={actionDisabled}
        handlers={actionHandlers}
      />
    </article>
  );
}
