import {
  sourcesToCitations,
  type ApiMessageSource,
} from "@/lib/chat-retrieval-stream";

export interface ParsedCitation {
  id: number;
  text: string;
  metadata: Record<string, unknown>;
}

/** Normalize model citation markers to markdown link syntax. */
export function normalizeCitationMarkdown(text: string): string {
  let normalized = text
    .replace(/\[\[([cC])itation/g, "[citation")
    .replace(/[cC]itation:(\d+)]]/g, "citation:$1]")
    .replace(/\[\[([cC]itation:\d+)]](?!])/g, `[$1]`)
    .replace(/\[[cC]itation:(\d+)]/g, "[citation]($1)");

  normalized = normalized.replace(
    /\[(\d+(?:\s*[,，]\s*\d+)+)\]/g,
    (_, nums: string) =>
      nums
        .split(/[\s,，]+/)
        .filter(Boolean)
        .map((n) => `[citation](${n.trim()})`)
        .join("")
  );

  normalized = normalized.replace(
    /(?<![\w])\[(\d+)\](?!\()/g,
    "[citation]($1)"
  );

  return normalized;
}

/** Remove citation markers for list previews and snippets. */
export function stripCitationMarkers(text: string): string {
  return text
    .replace(/\[citation\]\(\d+\)/gi, "")
    .replace(/\[[cC]itation:\d+]/g, "")
    .replace(/(?<![\w])\[(\d+)\](?!\()/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface ApiChatMessage {
  id: number;
  content: string;
  role: "assistant" | "user";
  feedback?: string | null;
  sources?: ApiMessageSource[];
}

/** Map API messages to UI chat messages. */
export function formatChatHistoryMessages(messages: ApiChatMessage[]) {
  return messages.map((msg) => {
    const feedback =
      msg.feedback === "like" || msg.feedback === "dislike"
        ? msg.feedback
        : null;

    if (msg.role !== "assistant") {
      return {
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        feedback,
      };
    }

    const citations =
      msg.sources && msg.sources.length > 0
        ? sourcesToCitations(msg.sources)
        : undefined;

    return {
      id: msg.id.toString(),
      role: "assistant" as "assistant",
      content: normalizeCitationMarkdown(msg.content),
      citations,
      feedback,
    };
  });
}

/** One-line preview for chat list (assistant answer text only). */
export function lastMessagePreview(content: string): string {
  if (!content) return "";
  return stripCitationMarkers(normalizeCitationMarkdown(content))
    .replace(/\s+/g, " ")
    .trim();
}
