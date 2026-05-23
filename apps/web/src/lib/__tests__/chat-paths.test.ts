import {
  isChatUuid,
  parseRouteChatId,
} from "@/lib/chat-paths";

describe("chat-paths", () => {
  it("accepts valid ULID routes", () => {
    const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    expect(isChatUuid(id)).toBe(true);
    expect(parseRouteChatId(id)).toBe(id);
  });

  it("rejects non-ULID ids", () => {
    expect(parseRouteChatId("42")).toBeNull();
    expect(parseRouteChatId("550e8400-e29b-41d4-a716-446655440000")).toBeNull();
  });
});
