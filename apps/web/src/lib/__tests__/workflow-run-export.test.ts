import {
  looksLikeMarkdown,
  shouldRenderMarkdown,
} from "@/lib/workflow-run-export";

describe("workflow-run-export", () => {
  it("detects markdown patterns", () => {
    expect(looksLikeMarkdown("# Title\n\nBody")).toBe(true);
    expect(looksLikeMarkdown("plain text only")).toBe(false);
  });

  it("respects output format markdown", () => {
    expect(shouldRenderMarkdown("plain", "markdown")).toBe(true);
    expect(shouldRenderMarkdown("plain", "text")).toBe(false);
  });
});
