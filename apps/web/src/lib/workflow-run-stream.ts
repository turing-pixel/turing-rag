import { getAuthHeaders, parseHttpErrorResponse } from "@/lib/api";
import { getApiBase } from "@/lib/public-urls";

export type WorkflowStreamEventType =
  | "run_start"
  | "step_start"
  | "step_complete"
  | "step_failed"
  | "run_complete";

export interface WorkflowStreamEvent {
  type: WorkflowStreamEventType;
  run_uuid?: string;
  step_key?: string;
  step_type?: string;
  status?: string;
  output?: Record<string, unknown>;
  error?: string;
  halted?: boolean;
}

export interface WorkflowRunStreamOptions {
  workflowUuid: string;
  input: Record<string, unknown>;
  onEvent: (event: WorkflowStreamEvent) => void;
  signal?: AbortSignal;
}

export async function runWorkflowStream(
  options: WorkflowRunStreamOptions
): Promise<string | null> {
  const { workflowUuid, input, onEvent, signal } = options;
  const url = `${getApiBase()}/api/workflows/${workflowUuid}/runs?stream=true`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ input }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await parseHttpErrorResponse(response));
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming not supported");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let runUuid: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        const event = JSON.parse(json) as WorkflowStreamEvent;
        onEvent(event);
        if (event.run_uuid) {
          runUuid = event.run_uuid;
        }
        if (event.type === "run_complete" && event.run_uuid) {
          runUuid = event.run_uuid;
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }

  return runUuid;
}
