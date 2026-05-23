import { chatIndexPath } from "@/lib/chat-paths";

/** Build dashboard chat URL with pre-selected knowledge base(s). */
export function chatUrlWithKnowledgeBases(
  kbUuids: string | string[]
): string {
  const uuids = Array.isArray(kbUuids) ? kbUuids : [kbUuids];
  if (uuids.length === 0) return chatIndexPath();
  if (uuids.length === 1) {
    return chatIndexPath(new URLSearchParams({ kb_uuid: uuids[0] }));
  }
  return chatIndexPath(
    new URLSearchParams({ kb_uuids: uuids.join(",") })
  );
}
