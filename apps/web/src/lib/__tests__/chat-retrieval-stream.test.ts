import {
  appendRetrievalDocuments,
  applyRetrievalStreamEvent,
  INITIAL_RETRIEVAL_STREAM_STATE,
  isRetrievalStreamEvent,
  retrievalStreamToCitations,
} from "@/lib/chat-retrieval-stream";

describe("isRetrievalStreamEvent", () => {
  it("accepts retrieval events", () => {
    expect(
      isRetrievalStreamEvent({ type: "retrieval", phase: "start", query: "hi" })
    ).toBe(true);
  });

  it("rejects other payloads", () => {
    expect(isRetrievalStreamEvent({ type: "other" })).toBe(false);
    expect(isRetrievalStreamEvent(null)).toBe(false);
  });
});

describe("applyRetrievalStreamEvent", () => {
  it("accumulates search query and documents", () => {
    let state = INITIAL_RETRIEVAL_STREAM_STATE;
    state = applyRetrievalStreamEvent(state, {
      type: "retrieval",
      phase: "start",
      query: "什么是 RAG",
    });
    state = applyRetrievalStreamEvent(state, {
      type: "retrieval",
      phase: "query",
      search_query: "RAG 定义",
    });
    state = applyRetrievalStreamEvent(state, {
      type: "retrieval",
      phase: "results",
      count: 1,
      documents: [{ file_name: "doc.pdf", preview: "snippet" }],
    });

    expect(state.query).toBe("什么是 RAG");
    expect(state.searchQuery).toBe("RAG 定义");
    expect(state.count).toBe(1);
    expect(state.documents).toHaveLength(1);
  });

  it("appends documents on each searching phase hit", () => {
    let state = INITIAL_RETRIEVAL_STREAM_STATE;
    state = applyRetrievalStreamEvent(state, {
      type: "retrieval",
      phase: "searching",
      count: 1,
      documents: [{ file_name: "a.pdf", preview: "a" }],
    });
    state = applyRetrievalStreamEvent(state, {
      type: "retrieval",
      phase: "searching",
      count: 2,
      documents: [{ file_name: "b.pdf", preview: "b" }],
    });
    expect(state.phase).toBe("searching");
    expect(state.documents).toHaveLength(2);
    expect(state.count).toBe(2);
  });

  it("deduplicates streamed documents", () => {
    const merged = appendRetrievalDocuments(
      [{ file_name: "a.pdf", preview: "a", document_id: 1, kb_id: 1 }],
      [{ file_name: "a.pdf", preview: "a", document_id: 1, kb_id: 1 }]
    );
    expect(merged).toHaveLength(1);
  });

  it("tracks ranking stats and final documents", () => {
    let state = INITIAL_RETRIEVAL_STREAM_STATE;
    state = applyRetrievalStreamEvent(state, {
      type: "retrieval",
      phase: "ranking",
      recalled_count: 10,
      selected_count: 4,
      count: 4,
      documents: [
        { file_name: "a.pdf", preview: "a" },
        { file_name: "b.pdf", preview: "b" },
      ],
    });
    expect(state.recalledCount).toBe(10);
    expect(state.selectedCount).toBe(4);
    expect(state.documents).toHaveLength(2);
  });

  it("dedupes ranking documents by file for the sources list", () => {
    const state = applyRetrievalStreamEvent(INITIAL_RETRIEVAL_STREAM_STATE, {
      type: "retrieval",
      phase: "ranking",
      documents: [
        {
          file_name: "law.docx",
          preview: "chunk one",
          document_id: 41,
          kb_id: 1,
        },
        {
          file_name: "law.docx",
          preview: "chunk two",
          document_id: 41,
          kb_id: 1,
        },
      ],
    });
    expect(state.documents).toHaveLength(1);
    expect(state.documents[0].preview).toBe("chunk one");
  });

  it("ignores meta phase without mutating state", () => {
    const state = applyRetrievalStreamEvent(INITIAL_RETRIEVAL_STREAM_STATE, {
      type: "retrieval",
      phase: "meta",
      assistant_message_id: 42,
      user_message_id: 41,
    });
    expect(state).toEqual(INITIAL_RETRIEVAL_STREAM_STATE);
  });

  it("stores full citations from results phase", () => {
    let state = INITIAL_RETRIEVAL_STREAM_STATE;
    state = applyRetrievalStreamEvent(state, {
      type: "retrieval",
      phase: "results",
      count: 1,
      citations: [
        {
          file_name: "doc.pdf",
          preview: "snippet",
          page_content: "full body",
          metadata: { document_id: 9 },
        },
      ],
    });
    expect(state.citations).toHaveLength(1);
    const mapped = retrievalStreamToCitations(state);
    expect(mapped[0].text).toBe("full body");
    expect(mapped[0].id).toBe(1);
  });
});
