/** Build dashboard chat URLs (path-based `/dashboard/chat/[uuid]`). */

const CHAT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isChatUuid(value: string): boolean {
  return CHAT_UUID_RE.test(value);
}

export function parseRouteChatId(
  id: string | string[] | undefined
): string | null {
  const raw = Array.isArray(id) ? id[0] : id;
  if (!raw || !isChatUuid(raw)) return null;
  return raw;
}

export function chatConversationPath(
  chatId: string,
  query?: string | URLSearchParams
): string {
  const base = `/dashboard/chat/${chatId}`;
  if (!query) return base;
  const qs = typeof query === "string" ? query : query.toString();
  return qs ? `${base}?${qs}` : base;
}

export function chatIndexPath(query?: string | URLSearchParams): string {
  if (!query) return "/dashboard/chat";
  const qs = typeof query === "string" ? query : query.toString();
  return qs ? `/dashboard/chat?${qs}` : "/dashboard/chat";
}
