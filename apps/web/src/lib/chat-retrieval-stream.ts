/** Retrieval status events streamed on Vercel AI data stream type `2`. */

export type RetrievalStreamPhase =
  | "meta"
  | "start"
  | "rewriting"
  | "query"
  | "search"
  | "searching"
  | "document"
  | "ranking"
  | "results";

export interface RetrievalStreamDocument {
  file_name: string;
  preview: string;
  page_content?: string;
  metadata?: Record<string, unknown>;
  document_id?: number | null;
  kb_id?: number | null;
}

export interface RetrievalStreamKnowledgeBase {
  id: number;
  name: string;
}

export interface RetrievalStreamEvent {
  type: "retrieval";
  phase: RetrievalStreamPhase;
  query?: string;
  search_query?: string;
  knowledge_bases?: RetrievalStreamKnowledgeBase[];
  documents?: RetrievalStreamDocument[];
  /** Full citation payloads (preferred over base64 in text stream). */
  citations?: RetrievalStreamDocument[];
  count?: number;
  recalled_count?: number;
  selected_count?: number;
  user_message_id?: number;
  assistant_message_id?: number;
}

export interface RetrievalStreamState {
  phase: RetrievalStreamPhase | null;
  query: string | null;
  searchQuery: string | null;
  knowledgeBases: RetrievalStreamKnowledgeBase[];
  documents: RetrievalStreamDocument[];
  citations: RetrievalStreamDocument[];
  count: number | null;
  recalledCount: number | null;
  selectedCount: number | null;
  /** True when contextual query rewrite ran (even if text unchanged). */
  rewriteAttempted: boolean;
}

export const INITIAL_RETRIEVAL_STREAM_STATE: RetrievalStreamState = {
  phase: null,
  query: null,
  searchQuery: null,
  knowledgeBases: [],
  documents: [],
  citations: [],
  count: null,
  recalledCount: null,
  selectedCount: null,
  rewriteAttempted: false,
};

export interface StreamCitation {
  id: number;
  text: string;
  metadata: Record<string, unknown>;
}

/** Map retrieval `citations` / `documents` payloads to UI citation shape. */
export function retrievalStreamToCitations(
  state: RetrievalStreamState
): StreamCitation[] {
  const sources =
    state.citations.length > 0 ? state.citations : state.documents;
  return sources
    .filter((doc) => (doc.page_content ?? doc.preview)?.trim())
    .map((doc, index) => ({
      id: index + 1,
      text: doc.page_content ?? doc.preview,
      metadata: doc.metadata ?? {
        file_name: doc.file_name,
        document_id: doc.document_id,
        kb_id: doc.kb_id,
      },
    }));
}

export function isRetrievalStreamEvent(
  value: unknown
): value is RetrievalStreamEvent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "retrieval" && typeof record.phase === "string";
}

export function retrievalDocumentKey(doc: RetrievalStreamDocument): string {
  return `${doc.kb_id ?? ""}:${doc.document_id ?? ""}:${doc.file_name}`;
}

export function appendRetrievalDocuments(
  existing: RetrievalStreamDocument[],
  incoming: RetrievalStreamDocument[]
): RetrievalStreamDocument[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map(retrievalDocumentKey));
  const added: RetrievalStreamDocument[] = [];
  for (const doc of incoming) {
    const key = retrievalDocumentKey(doc);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(doc);
  }
  return added.length > 0 ? [...existing, ...added] : existing;
}

export function applyRetrievalStreamEvent(
  prev: RetrievalStreamState,
  event: RetrievalStreamEvent
): RetrievalStreamState {
  if (event.phase === "meta") {
    return prev;
  }

  const next: RetrievalStreamState = { ...prev, phase: event.phase };

  if (event.phase === "rewriting") {
    next.rewriteAttempted = true;
  }

  if (event.query != null) {
    next.query = event.query;
  }
  if (event.search_query != null) {
    next.searchQuery = event.search_query;
  }
  if (event.knowledge_bases != null) {
    next.knowledgeBases = event.knowledge_bases;
  }
  const isIncrementalDoc =
    (event.phase === "searching" || event.phase === "document") &&
    event.documents != null &&
    event.documents.length > 0;

  if (isIncrementalDoc && event.documents) {
    next.documents = appendRetrievalDocuments(prev.documents, event.documents);
  } else if (event.documents != null) {
    if (event.phase === "ranking") {
      // One row per file in the sources list (backend may return multiple chunks).
      next.documents = appendRetrievalDocuments([], event.documents);
    } else if (event.phase === "results" && prev.documents.length > 0) {
      next.documents = appendRetrievalDocuments(prev.documents, event.documents);
    } else {
      next.documents = event.documents;
    }
  }
  if (event.citations != null) {
    next.citations = event.citations;
  }
  if (event.count != null) {
    next.count = event.count;
  }
  if (event.recalled_count != null) {
    next.recalledCount = event.recalled_count;
  }
  if (event.selected_count != null) {
    next.selectedCount = event.selected_count;
  }

  return next;
}
