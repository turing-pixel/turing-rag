export interface ParsedCitation {
  id: number;
  text: string;
  metadata: Record<string, unknown>;
}

export interface ParsedAssistantMessage {
  content: string;
  citations?: ParsedCitation[];
}

const LLM_RESPONSE_SEPARATOR = "__LLM_RESPONSE__";

/** Normalize model citation markers to markdown link syntax. */
export function normalizeCitationMarkdown(text: string): string {
  let normalized = text
    .replace(/\[\[([cC])itation/g, "[citation")
    .replace(/[cC]itation:(\d+)]]/g, "citation:$1]")
    .replace(/\[\[([cC]itation:\d+)]](?!])/g, `[$1]`)
    .replace(/\[[cC]itation:(\d+)]/g, "[citation]($1)");

  // [1, 2] or [1，2] — multiple refs in one bracket
  normalized = normalized.replace(
    /\[(\d+(?:\s*[,，]\s*\d+)+)\]/g,
    (_, nums: string) =>
      nums
        .split(/[\s,，]+/)
        .filter(Boolean)
        .map((n) => `[citation](${n.trim()})`)
        .join("")
  );

  // Bare [5] — model shorthand for context index (not a markdown link yet)
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

function parseContextPayload(base64Part: string): ParsedCitation[] {
  const contextData = JSON.parse(atob(base64Part.trim())) as {
    context: Array<{
      page_content: string;
      metadata: Record<string, unknown>;
    }>;
  };

  return (
    contextData?.context.map((citation, index) => ({
      id: index + 1,
      text: citation.page_content,
      metadata: citation.metadata,
    })) ?? []
  );
}

/** Parse stored assistant message (DB) into display content + citations. */
export function parseAssistantMessage(
  content: string
): ParsedAssistantMessage {
  if (!content) {
    return { content: "" };
  }

  if (!content.includes(LLM_RESPONSE_SEPARATOR)) {
    if (isContextPrefixOnly(content)) {
      return { content: "" };
    }
    return { content: normalizeCitationMarkdown(content) };
  }

  try {
    const [base64Part, responseText] = content.split(LLM_RESPONSE_SEPARATOR);
    const citations = base64Part ? parseContextPayload(base64Part) : [];
    return {
      content: normalizeCitationMarkdown(responseText || ""),
      citations: citations.length > 0 ? citations : undefined,
    };
  } catch {
    return { content: normalizeCitationMarkdown(content) };
  }
}

export type AssistantStreamPhase = "retrieving" | "generating";

export interface AssistantStreamStatus {
  phase: AssistantStreamPhase;
  citationCount: number | null;
}

/** Infer retrieval vs generation phase from raw streamed assistant content. */
export function getAssistantStreamStatus(
  rawContent: string,
  isLoading: boolean,
  retrievalCitationCount?: number | null
): AssistantStreamStatus | null {
  if (!isLoading) return null;

  const trimmed = rawContent.trim();
  if (!trimmed || !trimmed.includes(LLM_RESPONSE_SEPARATOR)) {
    return { phase: "retrieving", citationCount: null };
  }

  const [base64Part] = trimmed.split(LLM_RESPONSE_SEPARATOR);
  let citationCount: number | null = retrievalCitationCount ?? null;
  if (citationCount == null && base64Part) {
    try {
      citationCount = parseContextPayload(base64Part).length;
    } catch {
      citationCount = null;
    }
  }

  return {
    phase: "generating",
    citationCount: citationCount && citationCount > 0 ? citationCount : null,
  };
}

/** True while stream is still emitting base64 context before the answer separator. */
export function isContextPrefixOnly(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed || trimmed.includes(LLM_RESPONSE_SEPARATOR)) {
    return false;
  }
  if (trimmed.length < 16) {
    return false;
  }
  return /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
}

/** One-line preview for chat list (strips context prefix). */
export function lastMessagePreview(content: string): string {
  if (!content) return "";
  const parsed = parseAssistantMessage(content);
  if (parsed.content) {
    return stripCitationMarkers(parsed.content).replace(/\s+/g, " ").trim();
  }
  return "";
}

/** Map API messages to UI chat messages. */
export function formatChatHistoryMessages(
  messages: Array<{
    id: number;
    content: string;
    role: "assistant" | "user";
    feedback?: string | null;
  }>
) {
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

    const parsed = parseAssistantMessage(msg.content);
    return {
      id: msg.id.toString(),
      role: "assistant" as "assistant",
      content: parsed.content,
      citations: parsed.citations,
      feedback,
    };
  });
}
