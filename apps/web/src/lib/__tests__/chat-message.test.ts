import {
  formatChatHistoryMessages,
  normalizeCitationMarkdown,
  stripCitationMarkers,
} from "@/lib/chat-message";
import type { ApiMessageSource } from "@/lib/chat-retrieval-stream";

describe("normalizeCitationMarkdown", () => {
  it("converts [citation:n] to markdown links", () => {
    expect(normalizeCitationMarkdown("See [citation:3] here.")).toBe(
      "See [citation](3) here."
    );
  });

  it("converts bare [n] shorthand to markdown links", () => {
    expect(normalizeCitationMarkdown("Answer text [5] and [12].")).toBe(
      "Answer text [citation](5) and [citation](12)."
    );
  });

  it("converts comma-separated refs in one bracket", () => {
    expect(normalizeCitationMarkdown("Sources [1, 2] noted.")).toBe(
      "Sources [citation](1)[citation](2) noted."
    );
  });

  it("does not alter existing markdown links with numeric href", () => {
    expect(normalizeCitationMarkdown("Already [citation](4) done.")).toBe(
      "Already [citation](4) done."
    );
  });

  it("does not alter non-citation bracket text", () => {
    expect(normalizeCitationMarkdown("Use array[0] in code.")).toBe(
      "Use array[0] in code."
    );
  });
});

describe("stripCitationMarkers", () => {
  it("removes normalized citation links from preview text", () => {
    expect(stripCitationMarkers("Hello [citation](2) world.")).toBe(
      "Hello world."
    );
  });
});

describe("formatChatHistoryMessages", () => {
  it("maps API sources to citations with UTF-8 excerpt text", () => {
    const sources: ApiMessageSource[] = [
      {
        rank: 1,
        document_id: 10,
        kb_uuid: "kb-uuid-1",
        file_name: "中华人民共和国工会法.docx",
        excerpt: "中华人民共和国工会法",
        text: "中华人民共和国工会法",
        preview: "中华人民共和国工会法",
      },
    ];
    const formatted = formatChatHistoryMessages([
      {
        id: 2,
        role: "assistant",
        content: "根据工会法，答案是……",
        sources,
      },
    ]);
    expect(formatted[0].citations?.[0]?.text).toBe("中华人民共和国工会法");
    expect(formatted[0].content).toContain("根据工会法");
  });
});
