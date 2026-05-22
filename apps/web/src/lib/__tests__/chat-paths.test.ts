import {
  isChatUuid,
  parseRouteChatId,
} from "@/lib/chat-paths";

describe("chat-paths", () => {
  it("accepts valid uuid routes", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(isChatUuid(id)).toBe(true);
    expect(parseRouteChatId(id)).toBe(id);
  });

  it("rejects numeric legacy ids", () => {
    expect(parseRouteChatId("42")).toBeNull();
  });
});
