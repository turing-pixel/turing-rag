import { api } from "@/lib/api";

export type ProcessingTaskStatus = {
  document_id: number | null;
  upload_id: number;
  status: "pending" | "processing" | "completed" | "failed";
  error_message?: string;
  file_name?: string;
};

export type ProcessingTaskStatusMap = Record<number, ProcessingTaskStatus>;

type TaskStatusResponse = Record<string, ProcessingTaskStatus>;

export type RunProcessingPollOptions = {
  knowledgeBaseId: number;
  taskIds: number[];
  uploadIdByTaskId: Map<number, number>;
  shouldAbort: () => boolean;
  onUpdate?: (statuses: ProcessingTaskStatusMap) => void;
  onDone: (result: {
    allSucceeded: boolean;
    failedTasks: ProcessingTaskStatus[];
  }) => void;
  onError: () => void;
  pollIntervalMs?: number;
  maxRetries?: number;
};

function parseTaskStatuses(
  response: TaskStatusResponse,
  uploadIdByTaskId: Map<number, number>
): ProcessingTaskStatusMap {
  return Object.entries(response).reduce<ProcessingTaskStatusMap>(
    (acc, [key, value]) => {
      const taskId = parseInt(key, 10);
      const raw = value as ProcessingTaskStatus & { upload_id?: number };
      acc[taskId] = {
        document_id: raw.document_id ?? null,
        upload_id: raw.upload_id ?? uploadIdByTaskId.get(taskId) ?? 0,
        status: raw.status,
        error_message: raw.error_message,
        file_name: raw.file_name,
      };
      return acc;
    },
    {}
  );
}

export function runProcessingPoll({
  knowledgeBaseId,
  taskIds,
  uploadIdByTaskId,
  shouldAbort,
  onUpdate,
  onDone,
  onError,
  pollIntervalMs = 2000,
  maxRetries = 3,
}: RunProcessingPollOptions): void {
  let statusPollRetries = 0;

  const poll = async () => {
    if (shouldAbort()) return;

    try {
      const response = (await api.get(
        `/api/knowledge-base/${knowledgeBaseId}/documents/tasks?task_ids=${taskIds.join(
          ","
        )}`
      )) as TaskStatusResponse;

      const data = parseTaskStatuses(response, uploadIdByTaskId);
      statusPollRetries = 0;
      onUpdate?.(data);

      const allDone = Object.values(data).every(
        (task) => task.status === "completed" || task.status === "failed"
      );

      if (allDone) {
        const failedTasks = Object.values(data).filter(
          (task) => task.status === "failed"
        );
        onDone({
          allSucceeded: failedTasks.length === 0,
          failedTasks,
        });
      } else if (!shouldAbort()) {
        setTimeout(poll, pollIntervalMs);
      }
    } catch {
      statusPollRetries += 1;
      if (statusPollRetries < maxRetries && !shouldAbort()) {
        setTimeout(poll, pollIntervalMs);
        return;
      }
      onError();
    }
  };

  void poll();
}
