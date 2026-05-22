import type { Dispatch, SetStateAction } from "react";
import { isRetrievalStreamEvent } from "@/lib/chat-retrieval-stream";

export interface LocalStreamMessageIds {
  assistantId: string;
  userId?: string;
}

export interface AppliedStreamMessageIds {
  applied: boolean;
  assistantId?: string;
  userId?: string;
}

/** Map optimistic UUIDs to DB message ids from stream `meta` phase. */
export function applyStreamMessageIds<T extends { id: string }>(
  setMessages: Dispatch<SetStateAction<T[]>>,
  items: unknown[],
  localIds: LocalStreamMessageIds
): AppliedStreamMessageIds {
  let applied = false;
  let assistantId: string | undefined;
  let userId: string | undefined;

  for (const item of items) {
    if (!isRetrievalStreamEvent(item) || item.phase !== "meta") continue;

    const assistantDbId =
      item.assistant_message_id != null
        ? String(item.assistant_message_id)
        : null;
    const userDbId =
      item.user_message_id != null ? String(item.user_message_id) : null;

    if (!assistantDbId && !userDbId) continue;

    applied = true;
    if (assistantDbId) assistantId = assistantDbId;
    if (userDbId) userId = userDbId;
    setMessages((prev) =>
      prev.map((m) => {
        if (assistantDbId && m.id === localIds.assistantId) {
          return { ...m, id: assistantDbId };
        }
        if (userDbId && localIds.userId && m.id === localIds.userId) {
          return { ...m, id: userDbId };
        }
        return m;
      })
    );
  }

  return { applied, assistantId, userId };
}
