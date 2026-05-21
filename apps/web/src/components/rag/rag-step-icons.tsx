import type { LucideIcon } from "lucide-react";
import {
  Binary,
  Bot,
  Database,
  Eye,
  GitBranch,
  HardDrive,
  ListChecks,
  MessageSquare,
  Play,
  Radio,
  Scissors,
  Search,
  Upload,
  Workflow,
} from "lucide-react";

import type { StepKey } from "@/components/rag/rag-pipeline-data";

export const STEP_ICONS: Record<StepKey, LucideIcon> = {
  upload: Upload,
  preview: Eye,
  process: Play,
  pollTasks: ListChecks,
  loadSplit: Scissors,
  embeddings: Binary,
  vectorStore: Database,
  persist: HardDrive,
  userMessage: MessageSquare,
  resolveLlm: Bot,
  retriever: Search,
  ragChain: Workflow,
  stream: Radio,
  testRetrieval: GitBranch,
};

const ICON_BG: Record<
  "api" | "service" | "storage" | "optional",
  string
> = {
  api: "bg-primary/15 text-primary",
  service: "bg-chart-2/15 text-chart-2",
  storage: "bg-chart-4/15 text-chart-4",
  optional: "bg-muted text-muted-foreground",
};

export function getStepIconBg(
  kind: "api" | "service" | "storage" | "optional"
): string {
  return ICON_BG[kind];
}
