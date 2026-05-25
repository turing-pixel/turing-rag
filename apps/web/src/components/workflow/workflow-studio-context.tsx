"use client";

import { createContext, useCallback, useContext } from "react";

import type { WorkflowStepSide } from "@/lib/workflow-step-placement";
import type { WorkflowStep } from "@/lib/workflow";

export type WorkflowStudioActions = {
  onStepChange: (nodeId: string, step: WorkflowStep) => void;
  onStepDelete: (nodeId: string) => void;
  onRequestAddStep: (fromNodeId: string, side: WorkflowStepSide) => void;
};

export type WorkflowStudioContextValue = WorkflowStudioActions & {
  expandedNodeId: string | null;
  setExpandedNodeId: (id: string | null | ((prev: string | null) => string | null)) => void;
  toggleExpanded: (id: string) => void;
};

const WorkflowStudioContext = createContext<WorkflowStudioContextValue | null>(null);

export function WorkflowStudioProvider({
  value,
  children,
}: {
  value: WorkflowStudioContextValue;
  children: React.ReactNode;
}) {
  return (
    <WorkflowStudioContext.Provider value={value}>
      {children}
    </WorkflowStudioContext.Provider>
  );
}

export function useWorkflowStudioContext(): WorkflowStudioContextValue {
  const ctx = useContext(WorkflowStudioContext);
  if (!ctx) {
    throw new Error("WorkflowStudio hooks must be used within WorkflowStudioProvider");
  }
  return ctx;
}

export function useWorkflowStudioActions(): WorkflowStudioActions {
  const { onStepChange, onStepDelete, onRequestAddStep } = useWorkflowStudioContext();
  return { onStepChange, onStepDelete, onRequestAddStep };
}

export function useWorkflowNodeExpand(nodeId: string) {
  const { expandedNodeId, setExpandedNodeId, toggleExpanded } = useWorkflowStudioContext();
  const expanded = expandedNodeId === nodeId;

  const collapse = useCallback(() => {
    setExpandedNodeId((current) => (current === nodeId ? null : current));
  }, [nodeId, setExpandedNodeId]);

  const expand = useCallback(() => {
    setExpandedNodeId(nodeId);
  }, [nodeId, setExpandedNodeId]);

  const toggle = useCallback(() => {
    toggleExpanded(nodeId);
  }, [nodeId, toggleExpanded]);

  return { expanded, collapse, expand, toggle };
}
