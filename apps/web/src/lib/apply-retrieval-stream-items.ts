import type { Dispatch, SetStateAction } from "react";
import {
  applyRetrievalStreamEvent,
  isRetrievalStreamEvent,
  type RetrievalStreamEvent,
  type RetrievalStreamState,
} from "@/lib/chat-retrieval-stream";

function isIncrementalSearchingEvent(event: RetrievalStreamEvent): boolean {
  return (
    event.phase === "searching" &&
    event.documents != null &&
    event.documents.length > 0
  );
}

/** Apply retrieval SSE payloads; yields a frame after each searching hit. */
export async function applyRetrievalStreamItems(
  setState: Dispatch<SetStateAction<RetrievalStreamState>>,
  items: unknown[]
): Promise<void> {
  for (const item of items) {
    if (!isRetrievalStreamEvent(item)) continue;
    if (item.phase === "meta") continue;

    setState((prev) => applyRetrievalStreamEvent(prev, item));

    if (isIncrementalSearchingEvent(item)) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
  }
}
