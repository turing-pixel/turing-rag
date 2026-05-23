/** Build dashboard chat URLs (path-based `/dashboard/chat/[uuid]`). */

import { isUlid } from "@/lib/ulid";

export function isChatUuid(value: string): boolean {
  return isUlid(value);
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
