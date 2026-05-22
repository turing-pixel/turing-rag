import type { RetrievalStreamPhase, RetrievalStreamState } from "@/lib/chat-retrieval-stream";

export type RetrievalStepId =
  | "rewrite"
  | "search"
  | "recall"
  | "rank"
  | "generate";

export type RetrievalStepStatus = "pending" | "active" | "done" | "skipped";

export interface RetrievalStepView {
  id: RetrievalStepId;
  status: RetrievalStepStatus;
}

const PHASE_ORDER: RetrievalStreamPhase[] = [
  "start",
  "rewriting",
  "query",
  "search",
  "searching",
  "document",
  "ranking",
  "results",
];

function phaseIndex(phase: RetrievalStreamPhase | null): number {
  if (phase == null) return -1;
  return PHASE_ORDER.indexOf(phase);
}

function hasRephrase(stream: RetrievalStreamState): boolean {
  return (
    stream.searchQuery != null &&
    stream.query != null &&
    stream.searchQuery.trim() !== stream.query.trim()
  );
}

export function buildRetrievalSteps(
  stream: RetrievalStreamState,
  options: {
    isStreaming: boolean;
    /** True while answer tokens stream (separator received, request in flight). */
    answerStarted: boolean;
    /** True when the assistant reply exists (stream ended or loaded from DB). */
    answerFinished: boolean;
  }
): RetrievalStepView[] {
  const { isStreaming, answerStarted, answerFinished } = options;
  const phase = stream.phase;
  const idx = phaseIndex(phase);
  const docCount = stream.documents.length;
  const recalled = stream.recalledCount ?? docCount;
  const selected = stream.selectedCount ?? stream.count ?? docCount;

  const rewriteSkipped = !stream.rewriteAttempted && idx >= phaseIndex("search");
  const rewriteDone =
    rewriteSkipped ||
    phase === "query" ||
    idx >= phaseIndex("search") ||
    (!isStreaming && stream.searchQuery != null);
  const rewriteActive =
    isStreaming && !answerStarted && phase === "rewriting";

  const searchDone =
    idx >= phaseIndex("searching") ||
    docCount > 0 ||
    phase === "ranking" ||
    phase === "results" ||
    (!isStreaming && stream.knowledgeBases.length > 0);
  const searchActive =
    isStreaming &&
    !answerStarted &&
    (phase === "search" ||
      (phase === "searching" && docCount === 0 && stream.recalledCount == null));

  const recallDone =
    phase === "ranking" ||
    phase === "results" ||
    (!isStreaming && docCount > 0) ||
    (!isStreaming && stream.count === 0);
  const recallActive =
    isStreaming &&
    !answerStarted &&
    (phase === "searching" || phase === "document") &&
    !recallDone;

  const rankDone =
    phase === "results" || answerStarted || (!isStreaming && selected > 0);
  const rankActive =
    isStreaming && !answerStarted && phase === "ranking";

  const generateDone = answerFinished && !isStreaming;
  const generateActive = isStreaming && answerStarted;

  function status(
    done: boolean,
    active: boolean,
    skipped = false
  ): RetrievalStepStatus {
    if (skipped) return "skipped";
    if (active) return "active";
    if (done) return "done";
    return "pending";
  }

  return [
    {
      id: "rewrite",
      status: status(rewriteDone, rewriteActive, rewriteSkipped && !hasRephrase(stream)),
    },
    { id: "search", status: status(searchDone, searchActive) },
    { id: "recall", status: status(recallDone, recallActive) },
    {
      id: "rank",
      status: status(
        rankDone,
        rankActive,
        rankDone && selected === 0 && recalled === 0
      ),
    },
    {
      id: "generate",
      status: status(generateDone, generateActive),
    },
  ];
}

export function formatKbNames(
  kbs: RetrievalStreamState["knowledgeBases"],
  max = 3,
  separator = ", "
): string {
  if (kbs.length === 0) return "";
  const names = kbs.map((kb) => kb.name);
  if (names.length <= max) return names.join(separator);
  return `${names.slice(0, max).join(separator)} +${names.length - max}`;
}
