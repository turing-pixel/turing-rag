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
  kb_uuid?: string | null;
  score?: number | null;
}

export interface RetrievalStreamKnowledgeBase {
  uuid: string;
  name: string;
}

export interface RetrievalStreamEvent {
  type: "retrieval";
  phase: RetrievalStreamPhase;
  query?: string;
  search_query?: string;
  knowledge_bases?: RetrievalStreamKnowledgeBase[];
  documents?: RetrievalStreamDocument[];
  citations?: RetrievalStreamDocument[];
  count?: number;
  recalled_count?: number;
  selected_count?: number;
  low_confidence?: boolean;
  confidence_reason?: string | null;
  best_score?: number | null;
  score_mode?: "distance" | "similarity" | string | null;
  score_threshold?: number | null;
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
  lowConfidence: boolean;
  confidenceReason: string | null;
  bestScore: number | null;
  scoreMode: string | null;
  scoreThreshold: number | null;
  rewriteAttempted: boolean;
}

export interface ApiMessageSource {
  rank: number;
  chunk_id?: string | null;
  document_id: number;
  kb_uuid: string;
  kb_name?: string | null;
  file_name: string;
  score?: number | null;
  excerpt: string;
  text: string;
  preview: string;
  stale?: boolean;
}

export interface ApiMessageRetrieval {
  user_query?: string;
  search_query?: string | null;
  rewrite_attempted?: boolean;
  knowledge_bases?: RetrievalStreamKnowledgeBase[];
  events?: RetrievalStreamEvent[];
  low_confidence?: boolean;
  confidence_reason?: string | null;
  best_score?: number | null;
  score_mode?: string | null;
  score_threshold?: number | null;
  recalled_count?: number | null;
  selected_count?: number | null;
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
  lowConfidence: false,
  confidenceReason: null,
  bestScore: null,
  scoreMode: null,
  scoreThreshold: null,
  rewriteAttempted: false,
};

export interface StreamCitation {
  id: number;
  text: string;
  metadata: Record<string, unknown>;
}

const RETRIEVAL_PREVIEW_MAX_LEN = 160;

function previewFromText(text: string): string {
  const normalized = text.replace(/\n/g, " ");
  if (normalized.length <= RETRIEVAL_PREVIEW_MAX_LEN) {
    return normalized;
  }
  return `${normalized.slice(0, RETRIEVAL_PREVIEW_MAX_LEN)}...`;
}

export function sourcesToRetrievalDocuments(
  sources: ApiMessageSource[]
): RetrievalStreamDocument[] {
  return sources.map((source) => ({
    file_name: source.file_name || "—",
    preview: source.preview || previewFromText(source.text || source.excerpt),
    page_content: source.text || source.excerpt,
    metadata: {
      file_name: source.file_name,
      document_id: source.document_id,
      kb_uuid: source.kb_uuid,
      kb_name: source.kb_name,
      chunk_id: source.chunk_id,
      score: source.score,
      stale: source.stale,
    },
    document_id: source.document_id,
    kb_uuid: source.kb_uuid,
    score: source.score ?? null,
  }));
}

export function sourcesToCitations(
  sources: ApiMessageSource[]
): StreamCitation[] {
  return sources.map((source) => ({
    id: source.rank,
    text: source.text || source.excerpt,
    metadata: {
      file_name: source.file_name,
      document_id: source.document_id,
      kb_uuid: source.kb_uuid,
      kb_name: source.kb_name,
      chunk_id: source.chunk_id,
      score: source.score,
      stale: source.stale,
    },
  }));
}

/** Hydrate retrieval panel state from persisted API fields after reload. */
export function retrievalStateFromApi(
  retrieval: ApiMessageRetrieval | null | undefined,
  sources: ApiMessageSource[] = [],
  linkedKnowledgeBases: RetrievalStreamKnowledgeBase[] = []
): RetrievalStreamState {
  if (!retrieval && sources.length === 0) {
    return INITIAL_RETRIEVAL_STREAM_STATE;
  }

  let state = INITIAL_RETRIEVAL_STREAM_STATE;
  for (const event of retrieval?.events ?? []) {
    if (isRetrievalStreamEvent(event)) {
      state = applyRetrievalStreamEvent(state, event);
    }
  }

  if (retrieval) {
    state = {
      ...state,
      query: retrieval.user_query ?? state.query,
      searchQuery: retrieval.search_query ?? state.searchQuery,
      rewriteAttempted: retrieval.rewrite_attempted ?? state.rewriteAttempted,
      knowledgeBases:
        retrieval.knowledge_bases?.length
          ? retrieval.knowledge_bases
          : state.knowledgeBases.length > 0
            ? state.knowledgeBases
            : linkedKnowledgeBases,
      lowConfidence: retrieval.low_confidence ?? state.lowConfidence,
      confidenceReason: retrieval.confidence_reason ?? state.confidenceReason,
      bestScore: retrieval.best_score ?? state.bestScore,
      scoreMode: retrieval.score_mode ?? state.scoreMode,
      scoreThreshold: retrieval.score_threshold ?? state.scoreThreshold,
      recalledCount: retrieval.recalled_count ?? state.recalledCount,
      selectedCount: retrieval.selected_count ?? state.selectedCount,
    };
  }

  if (sources.length > 0) {
    const documents = sourcesToRetrievalDocuments(sources);
    const count = documents.length;
    state = {
      ...state,
      phase: "results",
      documents: state.documents.length > 0 ? state.documents : documents,
      citations: state.citations.length > 0 ? state.citations : documents,
      count: state.count ?? count,
      recalledCount: state.recalledCount ?? count,
      selectedCount: state.selectedCount ?? count,
    };
  }

  if (state.phase == null && (state.documents.length > 0 || state.citations.length > 0)) {
    state = { ...state, phase: "results" };
  }

  return state;
}

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
        ...(doc.kb_uuid != null ? { kb_uuid: doc.kb_uuid } : {}),
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
  return `${doc.kb_uuid ?? ""}:${doc.document_id ?? ""}:${doc.file_name}`;
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
  if (event.low_confidence != null) {
    next.lowConfidence = event.low_confidence;
  }
  if (event.confidence_reason !== undefined) {
    next.confidenceReason = event.confidence_reason ?? null;
  }
  if (event.best_score !== undefined) {
    next.bestScore = event.best_score ?? null;
  }
  if (event.score_mode !== undefined) {
    next.scoreMode = event.score_mode ?? null;
  }
  if (event.score_threshold !== undefined) {
    next.scoreThreshold = event.score_threshold ?? null;
  }

  return next;
}
