import { chatIndexPath } from "@/lib/chat-paths";

/** Build dashboard chat URL with pre-selected knowledge base(s). */
export function chatUrlWithKnowledgeBases(kbIds: number | number[]): string {
  const ids = Array.isArray(kbIds) ? kbIds : [kbIds];
  if (ids.length === 0) return chatIndexPath();
  if (ids.length === 1) {
    return chatIndexPath(new URLSearchParams({ kb_id: String(ids[0]) }));
  }
  return chatIndexPath(
    new URLSearchParams({ kb_ids: ids.join(",") })
  );
}
