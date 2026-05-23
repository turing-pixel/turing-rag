import {
  appendRetrievalDocuments,
  applyRetrievalStreamEvent,
  retrievalStateFromApi,
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
      [
        {
          file_name: "a.pdf",
          preview: "a",
          document_id: 1,
          kb_uuid: "01KB0000000000000000000001",
        },
      ],
      [
        {
          file_name: "a.pdf",
          preview: "a",
          document_id: 1,
          kb_uuid: "01KB0000000000000000000001",
        },
      ]
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
          kb_uuid: "01KB0000000000000000000001",
        },
        {
          file_name: "law.docx",
          preview: "chunk two",
          document_id: 41,
          kb_uuid: "01KB0000000000000000000001",
        },
      ],
    });
    expect(state.documents).toHaveLength(1);
    expect(state.documents[0].preview).toBe("chunk one");
  });

  it("stores knowledge_bases with uuid field", () => {
    const state = applyRetrievalStreamEvent(INITIAL_RETRIEVAL_STREAM_STATE, {
      type: "retrieval",
      phase: "start",
      knowledge_bases: [{ uuid: "01KB0000000000000000000001", name: "Docs" }],
    });
    expect(state.knowledgeBases).toEqual([
      { uuid: "01KB0000000000000000000001", name: "Docs" },
    ]);
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

  it("tracks retrieval quality metadata", () => {
    const state = applyRetrievalStreamEvent(INITIAL_RETRIEVAL_STREAM_STATE, {
      type: "retrieval",
      phase: "results",
      low_confidence: true,
      confidence_reason: "below_score_threshold",
      best_score: 0.42,
      score_mode: "distance",
      score_threshold: 0.3,
    });

    expect(state.lowConfidence).toBe(true);
    expect(state.confidenceReason).toBe("below_score_threshold");
    expect(state.bestScore).toBe(0.42);
    expect(state.scoreMode).toBe("distance");
    expect(state.scoreThreshold).toBe(0.3);
  });
});

describe("retrievalStateFromApi", () => {
  it("rebuilds results phase and sources from persisted API fields", () => {
    const state = retrievalStateFromApi(
      {
        user_query: "工会法有哪些要点？",
        search_query: "工会法要点",
        rewrite_attempted: false,
        knowledge_bases: [
          { uuid: "01KBTEST00000000000000001", name: "法律" },
        ],
        events: [
          {
            type: "retrieval",
            phase: "results",
            count: 1,
          },
        ],
      },
      [
        {
          rank: 1,
          document_id: 3,
          kb_uuid: "01KBTEST00000000000000001",
          kb_name: "法律",
          file_name: "工会法.docx",
          excerpt: "中华人民共和国工会法相关内容",
          text: "中华人民共和国工会法相关内容",
          preview: "中华人民共和国工会法相关内容",
          score: 0.12,
        },
      ],
      [{ uuid: "01KBTEST00000000000000001", name: "法律" }]
    );

    expect(state.phase).toBe("results");
    expect(state.query).toBe("工会法有哪些要点？");
    expect(state.searchQuery).toBe("工会法要点");
    expect(state.documents).toHaveLength(1);
    expect(state.documents[0].file_name).toBe("工会法.docx");
    expect(state.documents[0].page_content).toContain("工会法");
    expect(state.documents[0].score).toBe(0.12);
    expect(state.knowledgeBases[0].name).toBe("法律");
  });

  it("returns initial state when no retrieval or sources exist", () => {
    expect(retrievalStateFromApi(null, [])).toEqual(
      INITIAL_RETRIEVAL_STREAM_STATE
    );
  });
});
