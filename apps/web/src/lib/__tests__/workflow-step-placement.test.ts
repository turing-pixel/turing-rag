import {
  connectionForNewStep,
  positionForNewStep,
} from "@/lib/workflow-step-placement";
import {
  WORKFLOW_NODE_LAYOUT_X_GAP,
  WORKFLOW_NODE_LAYOUT_Y_GAP,
} from "@/lib/workflow-graph-utils";

describe("workflow-step-placement", () => {
  const anchor = { x: 100, y: 200 };

  it("offsets new node by side", () => {
    expect(positionForNewStep(anchor, "right")).toEqual({
      x: 100 + WORKFLOW_NODE_LAYOUT_X_GAP,
      y: 200,
    });
    expect(positionForNewStep(anchor, "left")).toEqual({
      x: 100 - WORKFLOW_NODE_LAYOUT_X_GAP,
      y: 200,
    });
    expect(positionForNewStep(anchor, "bottom")).toEqual({
      x: 100,
      y: 200 + WORKFLOW_NODE_LAYOUT_Y_GAP,
    });
    expect(positionForNewStep(anchor, "top")).toEqual({
      x: 100,
      y: 200 - WORKFLOW_NODE_LAYOUT_Y_GAP,
    });
  });

  it("wires handles for each direction", () => {
    expect(connectionForNewStep("a", "b", "right")).toEqual({
      source: "a",
      sourceHandle: "right",
      target: "b",
      targetHandle: "left",
    });
    expect(connectionForNewStep("a", "b", "left")).toEqual({
      source: "b",
      sourceHandle: "right",
      target: "a",
      targetHandle: "left",
    });
    expect(connectionForNewStep("a", "b", "bottom")).toEqual({
      source: "a",
      sourceHandle: "bottom",
      target: "b",
      targetHandle: "top",
    });
    expect(connectionForNewStep("a", "b", "top")).toEqual({
      source: "b",
      sourceHandle: "bottom",
      target: "a",
      targetHandle: "top",
    });
  });
});
