import { applyStreamMessageIds } from "@/lib/apply-stream-message-ids";

describe("applyStreamMessageIds", () => {
  it("replaces optimistic ids from meta phase", () => {
    const messages = [
      { id: "local-user", role: "user" as const, content: "hi" },
      { id: "local-assistant", role: "assistant" as const, content: "" },
    ];
    let next = messages;

    const result = applyStreamMessageIds(
      (fn) => {
        next = typeof fn === "function" ? fn(messages) : fn;
      },
      [
        {
          type: "retrieval",
          phase: "meta",
          user_message_id: 10,
          assistant_message_id: 11,
        },
      ],
      { assistantId: "local-assistant", userId: "local-user" }
    );

    expect(result.applied).toBe(true);
    expect(result.assistantId).toBe("11");
    expect(result.userId).toBe("10");
    expect(next[0].id).toBe("10");
    expect(next[1].id).toBe("11");
  });
});
