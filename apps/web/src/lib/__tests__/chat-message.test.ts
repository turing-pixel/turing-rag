import {
  normalizeCitationMarkdown,
  stripCitationMarkers,
} from "@/lib/chat-message";

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
