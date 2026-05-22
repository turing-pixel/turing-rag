import { parseDataStreamLine } from "@/lib/ai-data-stream";

describe("parseDataStreamLine", () => {
  it("parses text chunks (type 0)", () => {
    expect(parseDataStreamLine('0:"hello"')).toBe("hello");
  });

  it("parses data chunks (type 2)", () => {
    const payload = [{ type: "retrieval", phase: "start" }];
    const part = parseDataStreamLine(`2:${JSON.stringify(payload)}`);
    expect(part).toEqual({ kind: "data", data: payload });
  });
});
