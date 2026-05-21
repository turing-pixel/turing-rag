import { parseDataStreamLine } from "../ai-data-stream";

describe("parseDataStreamLine", () => {
  it("parses text chunks", () => {
    expect(parseDataStreamLine('0:"hello\\nworld"')).toBe("hello\nworld");
  });

  it("returns null for finish lines", () => {
    expect(
      parseDataStreamLine('d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}')
    ).toBeNull();
  });

  it("throws on error lines", () => {
    expect(() => parseDataStreamLine('3:{"text":"LLM failed"}')).toThrow(
      "LLM failed"
    );
  });
});
