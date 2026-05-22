import { INITIAL_RETRIEVAL_STREAM_STATE } from "@/lib/chat-retrieval-stream";
import { buildRetrievalSteps } from "@/lib/retrieval-steps";

describe("buildRetrievalSteps", () => {
  it("marks rewrite active during rewriting phase", () => {
    const steps = buildRetrievalSteps(
      {
        ...INITIAL_RETRIEVAL_STREAM_STATE,
        phase: "rewriting",
        rewriteAttempted: true,
      },
      { isStreaming: true, answerStarted: false, answerFinished: false }
    );
    expect(steps.find((s) => s.id === "rewrite")?.status).toBe("active");
  });

  it("marks rank done after results", () => {
    const steps = buildRetrievalSteps(
      {
        ...INITIAL_RETRIEVAL_STREAM_STATE,
        phase: "results",
        recalledCount: 8,
        selectedCount: 5,
        count: 5,
        documents: [{ file_name: "a.pdf", preview: "x" }],
      },
      { isStreaming: false, answerStarted: false, answerFinished: true }
    );
    expect(steps.find((s) => s.id === "rank")?.status).toBe("done");
    expect(steps.find((s) => s.id === "generate")?.status).toBe("done");
  });

  it("marks generate done when stream ended with visible answer", () => {
    const steps = buildRetrievalSteps(
      {
        ...INITIAL_RETRIEVAL_STREAM_STATE,
        phase: "results",
        selectedCount: 3,
        documents: [{ file_name: "a.pdf", preview: "x" }],
      },
      { isStreaming: false, answerStarted: false, answerFinished: true }
    );
    expect(steps.find((s) => s.id === "generate")?.status).toBe("done");
  });
});
